import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { initDb } from '../db';
import { createRouter } from '../routes';
import { formatCSV } from '../../src/utils/csv';

function createTestApp() {
  const db = new Database(':memory:');
  initDb(db);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/v1', createRouter(db));

  return { app, db };
}

describe('API /api/v1', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    const test = createTestApp();
    app = test.app;
    db = test.db;
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/v1/settings', () => {
    it('returns default settings', async () => {
      const res = await request(app).get('/api/v1/settings');
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/v1/settings', () => {
    it('updates settings and returns them', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ totalDays: 28, state: 'BY' });
      expect(res.status).toBe(200);
    });

    it('rejects unknown German state codes with 400', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ state: 'XX' });
      expect(res.status).toBe(400);
    });

    it('rejects script-injection-like state strings with 400', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ state: '<script>alert(1)</script>' });
      expect(res.status).toBe(400);
    });

    it('rejects malformed employmentStartDate with 400', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ employmentStartDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('rejects malformed employmentEndDate with 400', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ employmentEndDate: '01/02/2026' });
      expect(res.status).toBe(400);
    });

    it('accepts empty string for employmentStartDate (clears the value)', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ employmentStartDate: '' });
      expect(res.status).toBe(200);
    });

    it('rejects malformed carryOverDeadline with 400', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ carryOverDeadline: 'not-a-deadline' });
      expect(res.status).toBe(400);
    });

    it('accepts MM-DD carryOverDeadline', async () => {
      const res = await request(app)
        .put('/api/v1/settings')
        .send({ carryOverDeadline: '03-31' });
      expect(res.status).toBe(200);
    });

    it('accepts all 16 valid German state codes', async () => {
      const codes = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
      for (const code of codes) {
        const res = await request(app).put('/api/v1/settings').send({ state: code });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('POST /api/v1/periods', () => {
    it('creates a period', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: 'Sommerurlaub',
          halfDay: false,
          type: 'urlaub',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.startDate).toBe('2026-07-01');
      expect(res.body.changedAt).toBeDefined();
    });

    it('returns 400 for missing startDate', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ endDate: '2026-07-15' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing endDate', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-01' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for a well-formed but non-existent calendar date', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-02-30', endDate: '2026-02-30', note: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for an out-of-range month/day', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-13-45', endDate: '2026-13-45', note: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when endDate is before startDate (reversed range)', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-10', endDate: '2026-07-01', note: '' });
      expect(res.status).toBe(400);
    });

    it('allows a single-day period (startDate === endDate)', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-10', endDate: '2026-07-10', note: '' });
      expect(res.status).toBe(201);
    });

    it('defaults type to urlaub', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-08-01', endDate: '2026-08-05', note: '' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('urlaub');
    });

    it('returns 409 when the new period overlaps an existing one', async () => {
      await request(app).post('/api/v1/periods').send({ startDate: '2026-07-01', endDate: '2026-07-05', note: '' });

      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-03', endDate: '2026-07-09', note: '' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/periods', () => {
    it('returns empty array when no periods', async () => {
      const res = await request(app).get('/api/v1/periods?year=2026');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns periods filtered by year', async () => {
      await request(app).post('/api/v1/periods').send({ startDate: '2026-06-01', endDate: '2026-06-05', note: '' });
      await request(app).post('/api/v1/periods').send({ startDate: '2026-12-20', endDate: '2027-01-05', note: '' });

      const res = await request(app).get('/api/v1/periods?year=2026');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('excludes periods outside the year', async () => {
      await request(app).post('/api/v1/periods').send({ startDate: '2025-12-20', endDate: '2025-12-30', note: '' });
      await request(app).post('/api/v1/periods').send({ startDate: '2026-06-01', endDate: '2026-06-05', note: '' });

      const res = await request(app).get('/api/v1/periods?year=2026');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('includes server-computed workDays for each period', async () => {
      // 2026-07-06..10 is Mon–Fri (no Hessen holiday that week) → 5 work days.
      await request(app).post('/api/v1/periods').send({ startDate: '2026-07-06', endDate: '2026-07-10', note: '' });

      const res = await request(app).get('/api/v1/periods?year=2026');
      expect(res.status).toBe(200);
      expect(res.body[0].workDays).toBe(5);
    });
  });

  describe('PUT /api/v1/periods/:id', () => {
    it('updates a period', async () => {
      const createRes = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-01', endDate: '2026-07-15', note: 'Original' });
      const id = createRes.body.id;

      const res = await request(app)
        .put(`/api/v1/periods/${id}`)
        .send({ note: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.note).toBe('Updated');
      expect(res.body.startDate).toBe('2026-07-01');
    });

    it('returns 404 for non-existent period', async () => {
      const res = await request(app)
        .put('/api/v1/periods/nonexistent')
        .send({ note: 'test' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when updating to a non-existent calendar date', async () => {
      const created = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-01', endDate: '2026-07-15', note: '' });

      const res = await request(app)
        .put(`/api/v1/periods/${created.body.id}`)
        .send({ startDate: '2026-02-30' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when an update would make endDate before startDate', async () => {
      const created = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-01', endDate: '2026-07-15', note: '' });

      const res = await request(app)
        .put(`/api/v1/periods/${created.body.id}`)
        .send({ endDate: '2026-06-30' });
      expect(res.status).toBe(400);
    });

    it('returns 409 when an update would overlap another period', async () => {
      await request(app).post('/api/v1/periods').send({ startDate: '2026-07-01', endDate: '2026-07-05', note: 'A' });
      const b = await request(app).post('/api/v1/periods').send({ startDate: '2026-08-01', endDate: '2026-08-05', note: 'B' });

      const res = await request(app)
        .put(`/api/v1/periods/${b.body.id}`)
        .send({ startDate: '2026-07-03', endDate: '2026-07-04' });
      expect(res.status).toBe(409);
    });

    it('allows updating a period without flagging self-overlap', async () => {
      const a = await request(app).post('/api/v1/periods').send({ startDate: '2026-07-01', endDate: '2026-07-05', note: 'A' });

      const res = await request(app).put(`/api/v1/periods/${a.body.id}`).send({ note: 'edited' });
      expect(res.status).toBe(200);
      expect(res.body.note).toBe('edited');
    });
  });

  describe('GET /api/v1/export.ics', () => {
    it('returns a valid ICS file', async () => {
      await request(app).post('/api/v1/periods').send({ startDate: '2026-07-01', endDate: '2026-07-15', note: 'Sommerurlaub' });

      const res = await request(app).get('/api/v1/export.ics?year=2026');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('BEGIN:VEVENT');
      expect(res.text).toContain('END:VCALENDAR');
    });

    it('returns empty ICS with no periods', async () => {
      const res = await request(app).get('/api/v1/export.ics?year=2026');
      expect(res.status).toBe(200);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
      expect(res.text).not.toContain('BEGIN:VEVENT');
    });
  });

  // ── Existing tests below ──

  describe('DELETE /api/v1/periods/:id', () => {
    it('deletes a period', async () => {
      const createRes = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-07-01', endDate: '2026-07-15', note: '' });
      const id = createRes.body.id;

      const res = await request(app).delete(`/api/v1/periods/${id}`);
      expect(res.status).toBe(204);

      const listRes = await request(app).get('/api/v1/periods?year=2026');
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 404 for non-existent period', async () => {
      const res = await request(app).delete('/api/v1/periods/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/remaining', () => {
    it('returns full entitlement for a full-year employee with no usage', async () => {
      const res = await request(app).get('/api/v1/remaining?year=2026');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        year: 2026,
        totalDays: 30,
        entitledDays: 30,
        usedDays: 0,
        carryOver: { available: 0, used: 0, expiresOn: '2026-03-31' },
        remaining: 30,
      });
    });

    it('pro-rates entitlement for a new hire (§ 4 BUrlG)', async () => {
      await request(app).put('/api/v1/settings').send({ employmentStartDate: '2026-10-01' });

      const res = await request(app).get('/api/v1/remaining?year=2026');
      expect(res.status).toBe(200);
      // Oct–Dec = 3 complete months → floor(3/12 * 30) = 7
      expect(res.body.entitledDays).toBe(7);
      expect(res.body.usedDays).toBe(0);
      expect(res.body.remaining).toBe(7);
    });

    it('reduces entitlement for an elternzeit leave period (§ 17 BEEG)', async () => {
      await request(app).post('/api/v1/periods').send({
        startDate: '2026-01-01', endDate: '2026-06-30', type: 'elternzeit', note: '',
      });

      const res = await request(app).get('/api/v1/remaining?year=2026');
      expect(res.status).toBe(200);
      // 6 full months → reduction (6/12) * 30 = 15; elternzeit is not consumed urlaub
      expect(res.body.entitledDays).toBe(15);
      expect(res.body.usedDays).toBe(0);
      expect(res.body.remaining).toBe(15);
    });

    it('reports carry-over consumed before the Mar 31 deadline', async () => {
      await request(app).put('/api/v1/settings').send({ carryOverDays: 5 });
      await request(app).post('/api/v1/periods').send({
        startDate: '2026-02-02', endDate: '2026-02-06', type: 'urlaub', note: '',
      });

      const res = await request(app).get('/api/v1/remaining?year=2026');
      expect(res.status).toBe(200);
      expect(res.body.usedDays).toBe(5);
      expect(res.body.carryOver).toEqual({ available: 5, used: 5, expiresOn: '2026-03-31' });
      expect(res.body.remaining).toBe(25);
    });
  });

  describe('GET /api/v1/export.csv', () => {
    it('returns the year\'s periods as CSV with the correct headers', async () => {
      await request(app).post('/api/v1/periods').send({
        startDate: '2026-07-01', endDate: '2026-07-03', note: 'Sommer; lang', type: 'urlaub',
      });
      await request(app).post('/api/v1/periods').send({
        startDate: '2026-09-01', endDate: '2026-09-01', note: '', halfDay: true, type: 'urlaub',
      });

      const listRes = await request(app).get('/api/v1/periods?year=2026');
      const expected = formatCSV(listRes.body, 'HE');

      const res = await request(app).get('/api/v1/export.csv?year=2026');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-type']).toContain('charset=utf-8');
      expect(res.headers['content-disposition']).toContain('urlaub-2026.csv');
      expect(res.text).toBe(expected);
    });

    it('returns just the header row when there are no periods', async () => {
      const res = await request(app).get('/api/v1/export.csv?year=2099');
      expect(res.status).toBe(200);
      expect(res.text).toBe('Start Date;End Date;Note;Type;Half Day;Work Days');
    });
  });

  describe('POST /api/v1/import', () => {
    function importCsv(csv: string) {
      return request(app).post('/api/v1/import').set('Content-Type', 'text/csv').send(csv);
    }

    it('imports an all-valid CSV with status 200', async () => {
      const csv = [
        'Start Date;End Date;Note;Type',
        '2026-07-01;2026-07-05;Sommer;urlaub',
        '2026-08-10;2026-08-14;Sommer2;urlaub',
      ].join('\n');

      const res = await importCsv(csv);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ imported: 2, skipped: [], errors: [] });

      const listRes = await request(app).get('/api/v1/periods?year=2026');
      expect(listRes.body).toHaveLength(2);
    });

    it('skips a row overlapping an existing period with status 207 and reason "overlap"', async () => {
      await request(app).post('/api/v1/periods').send({
        startDate: '2026-07-01', endDate: '2026-07-05', note: 'existing',
      });
      const csv = ['Start Date;End Date;Note;Type', '2026-07-03;2026-07-07;clash;urlaub'].join('\n');

      const res = await importCsv(csv);
      expect(res.status).toBe(207);
      expect(res.body.imported).toBe(0);
      expect(res.body.skipped).toHaveLength(1);
      expect(res.body.skipped[0].reason).toBe('overlap');
    });

    it('reports malformed-date rows in errors with status 207 while importing the valid rows', async () => {
      const csv = [
        'Start Date;End Date;Note;Type',
        '2026-07-01;2026-07-05;ok;urlaub',
        'not-a-date;2026-08-14;bad;urlaub',
      ].join('\n');

      const res = await importCsv(csv);
      expect(res.status).toBe(207);
      expect(res.body.imported).toBe(1);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('returns 400 when no rows are parseable', async () => {
      const csv = ['Start Date;End Date;Note', 'not-a-date;also-bad;x'].join('\n');

      const res = await importCsv(csv);
      expect(res.status).toBe(400);
      expect(res.body.imported).toBe(0);
    });
  });

  describe('GET /api/v1/holidays', () => {
    it('returns public holidays for the configured state as {date,name} entries', async () => {
      const res = await request(app).get('/api/v1/holidays?year=2026');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const newYear = res.body.find((h: { date: string }) => h.date === '2026-01-01');
      expect(newYear).toBeDefined();
      expect(typeof newYear.name).toBe('string');
      expect(newYear.name.length).toBeGreaterThan(0);
    });

    it('returns entries sorted by date', async () => {
      const res = await request(app).get('/api/v1/holidays?year=2026');
      const dates = res.body.map((h: { date: string }) => h.date);
      expect(dates).toEqual([...dates].sort());
    });

    it('honours a ?state= override (Epiphany is a holiday in BY but not HE)', async () => {
      const he = await request(app).get('/api/v1/holidays?year=2026');
      const by = await request(app).get('/api/v1/holidays?year=2026&state=BY');

      const hasEpiphany = (body: { date: string }[]) => body.some((h) => h.date === '2026-01-06');
      expect(hasEpiphany(he.body)).toBe(false);
      expect(hasEpiphany(by.body)).toBe(true);
    });

    it('rejects a missing or invalid year with 400', async () => {
      const res = await request(app).get('/api/v1/holidays?year=nope');
      expect(res.status).toBe(400);
    });

    it('rejects an invalid state code with 400', async () => {
      const res = await request(app).get('/api/v1/holidays?year=2026&state=XX');
      expect(res.status).toBe(400);
    });
  });
});
