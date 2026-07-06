import express, { Router } from 'express';
import type Database from 'better-sqlite3';
import {
  getAllPeriods,
  getPeriodsByYear,
  createPeriod,
  updatePeriod,
  deletePeriod,
  getSettings,
  updateSettings,
} from './db';
import { generateICS } from '../src/utils/ics';
import {
  countVacationWorkDays,
  countVacationWorkDaysInYear,
  countCarryOverUsed,
  carryOverDeadline,
  hasOverlap,
} from '../src/utils/calendar';
import { computeProRataEntitlement, computeLeaveReduction } from '../src/utils/entitlement';
import { formatCSV, parseImportCSV } from '../src/utils/csv';
import { getHolidayMap } from '../src/data/holidays';
import type { GermanState } from '../src/data/holidays';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MM_DD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const VALID_TYPES = new Set([
  'urlaub', 'bildungsurlaub', 'kur', 'sabbatical',
  'unbezahlterUrlaub', 'mutterschaftsurlaub', 'elternzeit', 'sonderurlaub',
]);
const VALID_STATES = new Set([
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
]);

function parseYear(raw: unknown): number | null {
  const n = parseInt(raw as string, 10);
  return isNaN(n) ? null : n;
}

// Upper bound for day-count settings; matches the UI inputs (min/max 60).
const MAX_DAY_SETTING = 60;

/** Strict integer parse: integers, or strings that are entirely an integer. */
function parseStrictInt(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return null;
}

function isISODate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  // Reject well-formed but non-existent dates (e.g. 2026-02-30, 2026-13-45)
  // by round-tripping through Date and checking the components survive.
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isISODateOrEmpty(v: unknown): v is string {
  return v === '' || isISODate(v);
}

function isMonthDay(v: unknown): v is string {
  return typeof v === 'string' && MM_DD_RE.test(v);
}


export function createRouter(db: Database.Database): Router {
  const router = Router();

  // Parse raw CSV bodies for the import endpoint (JSON is parsed app-level).
  router.use(express.text({ type: 'text/csv', limit: '1mb' }));

  // ── Periods ──────────────────────────────────────────────────────

  router.get('/periods', (req, res) => {
    let year: number | null = null;
    if (req.query.year !== undefined) {
      year = parseYear(req.query.year);
      if (year === null) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
    }
    const periods = year !== null ? getPeriodsByYear(db, year) : getAllPeriods(db);
    const state = getSettings(db).state as GermanState;
    const enriched = periods.map((p) => ({
      ...p,
      workDays: year !== null ? countVacationWorkDaysInYear(p, year, state) : countVacationWorkDays(p, state),
    }));
    res.json(enriched);
  });

  router.post('/periods', (req, res) => {
    const { startDate, endDate, note, halfDay, type } = req.body;

    if (!isISODate(startDate) || !isISODate(endDate)) {
      res.status(400).json({ error: 'startDate and endDate must be ISO dates (YYYY-MM-DD)' });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ error: 'endDate must be on or after startDate' });
      return;
    }
    if (type !== undefined && !VALID_TYPES.has(type)) {
      res.status(400).json({ error: 'Invalid type' });
      return;
    }

    if (hasOverlap(startDate, endDate, getAllPeriods(db))) {
      res.status(409).json({ error: 'overlaps an existing period' });
      return;
    }

    const period = createPeriod(db, {
      startDate,
      endDate,
      note: typeof note === 'string' ? note : '',
      halfDay: halfDay === true,
      type: type || 'urlaub',
    });

    res.status(201).json(period);
  });

  router.put('/periods/:id', (req, res) => {
    const { id } = req.params;
    const { startDate, endDate, note, halfDay, type } = req.body;

    if (startDate !== undefined && !isISODate(startDate)) {
      res.status(400).json({ error: 'startDate must be an ISO date (YYYY-MM-DD)' });
      return;
    }
    if (endDate !== undefined && !isISODate(endDate)) {
      res.status(400).json({ error: 'endDate must be an ISO date (YYYY-MM-DD)' });
      return;
    }
    if (type !== undefined && !VALID_TYPES.has(type)) {
      res.status(400).json({ error: 'Invalid type' });
      return;
    }

    const all = getAllPeriods(db);
    const current = all.find((p) => p.id === id);
    if (!current) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }
    const effectiveStart = startDate ?? current.startDate;
    const effectiveEnd = endDate ?? current.endDate;
    if (effectiveEnd < effectiveStart) {
      res.status(400).json({ error: 'endDate must be on or after startDate' });
      return;
    }
    if (hasOverlap(effectiveStart, effectiveEnd, all, id)) {
      res.status(409).json({ error: 'overlaps an existing period' });
      return;
    }

    const updates: Parameters<typeof updatePeriod>[2] = {};
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (note !== undefined) updates.note = String(note);
    if (halfDay !== undefined) updates.halfDay = halfDay === true;
    if (type !== undefined) updates.type = type;

    const updated = updatePeriod(db, id, updates);

    if (!updated) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    res.json(updated);
  });

  router.delete('/periods/:id', (req, res) => {
    const { id } = req.params;
    const deleted = deletePeriod(db, id);

    if (!deleted) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    res.status(204).send();
  });

  // ── ICS Export ──────────────────────────────────────────────────

  router.get('/export.ics', (req, res) => {
    const year = req.query.year !== undefined ? parseYear(req.query.year) : new Date().getFullYear();
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }
    const periods = getPeriodsByYear(db, year);
    const ics = generateICS(
      periods.map((p) => ({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        note: p.note,
        halfDay: p.halfDay,
        type: p.type,
      })),
      year
    );
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="urlaub-${year}.ics"`);
    res.send(ics);
  });

  // ── CSV Export ──────────────────────────────────────────────────

  router.get('/export.csv', (req, res) => {
    const year = req.query.year !== undefined ? parseYear(req.query.year) : new Date().getFullYear();
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }
    const settings = getSettings(db);
    const periods = getPeriodsByYear(db, year);
    const csv = formatCSV(periods, settings.state as GermanState);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="urlaub-${year}.csv"`);
    res.send(csv);
  });

  // ── CSV Import ──────────────────────────────────────────────────

  router.post('/import', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : '';
    const { periods, errors } = parseImportCSV(csv);

    if (periods.length === 0) {
      res.status(400).json({ imported: 0, skipped: [], errors });
      return;
    }

    const existing = getAllPeriods(db).map((p) => ({
      id: p.id,
      startDate: p.startDate,
      endDate: p.endDate,
    }));
    const skipped: Array<{ startDate: string; endDate: string; reason: string }> = [];
    let imported = 0;

    for (const period of periods) {
      if (hasOverlap(period.startDate, period.endDate, existing)) {
        skipped.push({ startDate: period.startDate, endDate: period.endDate, reason: 'overlap' });
        continue;
      }
      const created = createPeriod(db, {
        startDate: period.startDate,
        endDate: period.endDate,
        note: period.note,
        halfDay: period.halfDay === true,
        type: period.type ?? 'urlaub',
      });
      existing.push({ id: created.id, startDate: created.startDate, endDate: created.endDate });
      imported++;
    }

    const status = skipped.length > 0 || errors.length > 0 ? 207 : 200;
    res.status(status).json({ imported, skipped, errors });
  });

  // ── Remaining entitlement ───────────────────────────────────────

  router.get('/remaining', (req, res) => {
    const year = req.query.year !== undefined ? parseYear(req.query.year) : new Date().getFullYear();
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const settings = getSettings(db);
    const totalDays = settings.totalDays;
    const state = settings.state as GermanState;
    const periods = getPeriodsByYear(db, year);
    const urlaubPeriods = periods.filter((p) => !p.type || p.type === 'urlaub');

    const usedDays = urlaubPeriods.reduce(
      (sum, p) => sum + countVacationWorkDaysInYear(p, year, state),
      0,
    );
    const proRata = computeProRataEntitlement(
      settings.employmentStartDate,
      settings.employmentEndDate,
      year,
      totalDays,
    );
    const reduction = computeLeaveReduction(periods, year, totalDays);
    const entitledDays = Math.max(0, proRata - reduction);
    const carryOverUsed = countCarryOverUsed(urlaubPeriods, year, state, settings.carryOverDays);

    res.json({
      year,
      totalDays,
      entitledDays,
      usedDays,
      carryOver: {
        available: settings.carryOverDays,
        used: carryOverUsed,
        expiresOn: carryOverDeadline(year),
      },
      remaining: entitledDays - usedDays,
    });
  });

  // ── Public holidays ─────────────────────────────────────────────

  router.get('/holidays', (req, res) => {
    const year = parseYear(req.query.year);
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    let state = getSettings(db).state as GermanState;
    if (req.query.state !== undefined) {
      if (typeof req.query.state !== 'string' || !VALID_STATES.has(req.query.state)) {
        res.status(400).json({ error: 'state must be a valid German state code (e.g. BW, BY, HE)' });
        return;
      }
      state = req.query.state as GermanState;
    }

    const holidays = [...getHolidayMap(year, year, state).entries()]
      .map(([date, name]) => ({ date, name }))
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json(holidays);
  });

  // ── Settings ─────────────────────────────────────────────────────

  router.get('/settings', (_req, res) => {
    const settings = getSettings(db);
    res.json(settings);
  });

  router.put('/settings', (req, res) => {
    const body = req.body;
    const allowed: Record<string, unknown> = {};

    if (body.totalDays !== undefined) {
      const n = parseStrictInt(body.totalDays);
      if (n === null || n < 1 || n > MAX_DAY_SETTING) { res.status(400).json({ error: 'totalDays must be an integer 1–60' }); return; }
      allowed.totalDays = n;
    }
    if (body.state !== undefined) {
      if (typeof body.state !== 'string' || !VALID_STATES.has(body.state)) {
        res.status(400).json({ error: 'state must be a valid German state code (e.g. BW, BY, HE)' });
        return;
      }
      allowed.state = body.state;
    }
    if (body.carryOverDays !== undefined) {
      const n = parseStrictInt(body.carryOverDays);
      if (n === null || n < 0 || n > MAX_DAY_SETTING) { res.status(400).json({ error: 'carryOverDays must be an integer 0–60' }); return; }
      allowed.carryOverDays = n;
    }
    if (body.carryOverDeadline !== undefined) {
      if (!isMonthDay(body.carryOverDeadline)) {
        res.status(400).json({ error: 'carryOverDeadline must be MM-DD (e.g. 03-31)' });
        return;
      }
      allowed.carryOverDeadline = body.carryOverDeadline;
    }
    if (body.carryOverMaxDays !== undefined) {
      if (body.carryOverMaxDays === null) {
        allowed.carryOverMaxDays = null;
      } else {
        const n = parseStrictInt(body.carryOverMaxDays);
        if (n === null || n < 0 || n > MAX_DAY_SETTING) { res.status(400).json({ error: 'carryOverMaxDays must be an integer 0–60 or null' }); return; }
        allowed.carryOverMaxDays = n;
      }
    }
    if (body.employmentStartDate !== undefined) {
      if (!isISODateOrEmpty(body.employmentStartDate)) {
        res.status(400).json({ error: 'employmentStartDate must be an ISO date (YYYY-MM-DD) or empty' });
        return;
      }
      allowed.employmentStartDate = body.employmentStartDate;
    }
    if (body.employmentEndDate !== undefined) {
      if (!isISODateOrEmpty(body.employmentEndDate)) {
        res.status(400).json({ error: 'employmentEndDate must be an ISO date (YYYY-MM-DD) or empty' });
        return;
      }
      allowed.employmentEndDate = body.employmentEndDate;
    }
    if (body.bildungsUrlaubDays !== undefined) {
      const n = parseStrictInt(body.bildungsUrlaubDays);
      if (n === null || n < 0 || n > MAX_DAY_SETTING) { res.status(400).json({ error: 'bildungsUrlaubDays must be an integer 0–60' }); return; }
      allowed.bildungsUrlaubDays = n;
    }

    const settings = updateSettings(db, allowed);
    res.json(settings);
  });

  return router;
}
