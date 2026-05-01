import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { initDb } from '../db';
import { createRouter } from '../routes';

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

    it('defaults type to urlaub', async () => {
      const res = await request(app)
        .post('/api/v1/periods')
        .send({ startDate: '2026-08-01', endDate: '2026-08-05', note: '' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('urlaub');
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
});
