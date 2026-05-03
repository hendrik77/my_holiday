import { Router } from 'express';
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set([
  'urlaub', 'bildungsurlaub', 'kur', 'sabbatical',
  'unbezahlterUrlaub', 'mutterschaftsurlaub', 'elternzeit', 'sonderurlaub',
]);

function parseYear(raw: unknown): number | null {
  const n = parseInt(raw as string, 10);
  return isNaN(n) ? null : n;
}

function isISODate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE_RE.test(v);
}

export function createRouter(db: Database.Database): Router {
  const router = Router();

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
    if (body.state !== undefined) allowed.state = String(body.state);
    if (body.carryOverDays !== undefined) {
      const n = parseInt(body.carryOverDays, 10);
      if (isNaN(n) || n < 0) { res.status(400).json({ error: 'carryOverDays must be ≥ 0' }); return; }
      allowed.carryOverDays = n;
    }
    if (body.carryOverDeadline !== undefined) allowed.carryOverDeadline = String(body.carryOverDeadline);
    if (body.carryOverMaxDays !== undefined) allowed.carryOverMaxDays = body.carryOverMaxDays === null ? null : parseInt(body.carryOverMaxDays, 10);
    if (body.employmentStartDate !== undefined) allowed.employmentStartDate = String(body.employmentStartDate);
    if (body.employmentEndDate !== undefined) allowed.employmentEndDate = String(body.employmentEndDate);
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
