import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initDb } from '../db';
import { createApp } from '../app';

let db: Database.Database;

function makeApp() {
  db = new Database(':memory:');
  initDb(db);
  return createApp(db);
}

afterEach(() => {
  db.close();
});

describe('createApp error handling', () => {
  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/v1/periods')
      .set('Content-Type', 'application/json')
      .send('{"startDate": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 413 for an oversized JSON body', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/v1/periods')
      .set('Content-Type', 'application/json')
      .send(`{"note": "${'x'.repeat(40 * 1024)}"}`);
    expect(res.status).toBe(413);
    expect(res.body.error).toBeTruthy();
  });

  it('still serves the API routes', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(200);
    expect(res.body.totalDays).toBe(30);
  });
});
