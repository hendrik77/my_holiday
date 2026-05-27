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
  countVacationWorkDaysInYear,
  countCarryOverUsed,
  carryOverDeadline,
  hasOverlap,
} from '../src/utils/calendar';
import { computeProRataEntitlement, computeLeaveReduction } from '../src/utils/entitlement';
import { formatCSV } from '../src/utils/csv';
import { parseImportCSV } from '../src/utils/export';
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

function isISODate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE_RE.test(v);
}

function isISODateOrEmpty(v: unknown): v is string {
  return typeof v === 'string' && (v === '' || ISO_DATE_RE.test(v));
}

function isMonthDay(v: unknown): v is string {
  return typeof v === 'string' && MM_DD_RE.test(v);
}

/**
 * Canonical English messages for parseImportCSV (the browser passes a real i18n
 * `t`; the API/CLI surface is locale-independent, like the CSV export labels).
 */
function csvImportMessage(key: string, params?: Record<string, string | number>): string {
  switch (key) {
    case 'csv.emptyFile': return 'The CSV file is empty.';
    case 'csv.missingHeader': return 'No recognizable header row found.';
    case 'csv.missingColumns': return 'Required start/end date columns are missing.';
    case 'csv.invalidDate': return `Row ${params?.row}: invalid start date "${params?.value}".`;
    case 'csv.invalidEndDate': return `Row ${params?.row}: invalid end date "${params?.value}".`;
    case 'csv.noEntries': return 'No valid entries found in the CSV.';
    default: return key;
  }
}

export function createRouter(db: Database.Database): Router {
  const router = Router();

  // Parse raw CSV bodies for the import endpoint (JSON is parsed app-level).
  router.use(express.text({ type: 'text/csv', limit: '1mb' }));

  // ── Periods ──────────────────────────────────────────────────────

  router.get('/periods', (_req, res) => {
    const year = _req.query.year ? parseYear(_req.query.year) : null;
    if (_req.query.year && year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }
    const periods = year ? getPeriodsByYear(db, year) : getAllPeriods(db);
    res.json(periods);
  });

  router.post('/periods', (req, res) => {
    const { startDate, endDate, note, halfDay, type } = req.body;

    if (!isISODate(startDate) || !isISODate(endDate)) {
      res.status(400).json({ error: 'startDate and endDate must be ISO dates (YYYY-MM-DD)' });
      return;
    }
    if (type !== undefined && !VALID_TYPES.has(type)) {
      res.status(400).json({ error: 'Invalid type' });
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
    const year = req.query.year ? parseYear(req.query.year) ?? new Date().getFullYear() : new Date().getFullYear();
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
    const year = req.query.year ? parseYear(req.query.year) ?? new Date().getFullYear() : new Date().getFullYear();
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
    const { periods, errors } = parseImportCSV(csv, csvImportMessage);

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
    const year = req.query.year ? parseYear(req.query.year) : new Date().getFullYear();
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

  // ── Settings ─────────────────────────────────────────────────────

  router.get('/settings', (_req, res) => {
    const settings = getSettings(db);
    res.json(settings);
  });

  router.put('/settings', (req, res) => {
    const body = req.body;
    const allowed: Record<string, unknown> = {};

    if (body.totalDays !== undefined) {
      const n = parseInt(body.totalDays, 10);
      if (isNaN(n) || n < 1 || n > 365) { res.status(400).json({ error: 'totalDays must be 1–365' }); return; }
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
      const n = parseInt(body.carryOverDays, 10);
      if (isNaN(n) || n < 0) { res.status(400).json({ error: 'carryOverDays must be ≥ 0' }); return; }
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
        const n = parseInt(body.carryOverMaxDays, 10);
        if (isNaN(n) || n < 0) { res.status(400).json({ error: 'carryOverMaxDays must be ≥ 0 or null' }); return; }
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
      const n = parseInt(body.bildungsUrlaubDays, 10);
      if (isNaN(n) || n < 0) { res.status(400).json({ error: 'bildungsUrlaubDays must be ≥ 0' }); return; }
      allowed.bildungsUrlaubDays = n;
    }

    const settings = updateSettings(db, allowed);
    res.json(settings);
  });

  return router;
}
