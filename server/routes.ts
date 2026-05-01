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

export function createRouter(db: Database.Database): Router {
  const router = Router();

  // ── Periods ──────────────────────────────────────────────────────

  router.get('/periods', (_req, res) => {
    const year = _req.query.year ? parseInt(_req.query.year as string, 10) : null;
    const periods = year ? getPeriodsByYear(db, year) : getAllPeriods(db);
    res.json(periods);
  });

  router.post('/periods', (req, res) => {
    const { startDate, endDate, note, halfDay, type } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate are required' });
      return;
    }

    const period = createPeriod(db, {
      startDate,
      endDate,
      note: note || '',
      halfDay: halfDay || false,
      type: type || 'urlaub',
    });

    res.status(201).json(period);
  });

  router.put('/periods/:id', (req, res) => {
    const { id } = req.params;
    const { startDate, endDate, note, halfDay, type } = req.body;

    const updated = updatePeriod(db, id, { startDate, endDate, note, halfDay, type });

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
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
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
    const updates = req.body;
    const settings = updateSettings(db, updates);
    res.json(settings);
  });

  return router;
}
