import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initDb } from '../db';
import { createApp, type CreateAppOptions } from '../app';

let db: Database.Database;

function makeApp(options: CreateAppOptions = {}) {
  db = new Database(':memory:');
  initDb(db);
  return createApp(db, options);
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

describe('createApp CORS defaults', () => {
  it('does not reflect a non-local origin by default', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/settings').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows localhost dev origins by default', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/settings').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('allows 127.0.0.1 origins by default', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/settings').set('Origin', 'http://127.0.0.1:8080');
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8080');
  });

  it('honours an explicit corsOrigin override', async () => {
    const app = makeApp({ corsOrigin: 'https://holiday.example.lan' });
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Origin', 'https://holiday.example.lan');
    expect(res.headers['access-control-allow-origin']).toBe('https://holiday.example.lan');
  });
});

describe('createApp bearer-token auth', () => {
  const apiToken = 'test-token-123';

  it('rejects API requests without a token when apiToken is configured', async () => {
    const app = makeApp({ apiToken });
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects a wrong token', async () => {
    const app = makeApp({ apiToken });
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('accepts the configured token', async () => {
    const app = makeApp({ apiToken });
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${apiToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalDays).toBe(30);
  });

  it('protects mutating endpoints too', async () => {
    const app = makeApp({ apiToken });
    const res = await request(app)
      .post('/api/v1/periods')
      .send({ startDate: '2026-07-01', endDate: '2026-07-03', note: '' });
    expect(res.status).toBe(401);
  });

  it('requires no token when apiToken is not configured', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(200);
  });
});

describe('createApp /health', () => {
  it('responds with status ok', async () => {
    const app = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('stays reachable without a token when apiToken is configured', async () => {
    const app = makeApp({ apiToken: 'secret' });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('createApp unknown API routes', () => {
  it('returns a JSON 404 for unknown /api paths', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.error).toBeTruthy();
  });

  it('returns a JSON 404 for unknown /api paths even with static serving enabled', async () => {
    const app = makeApp({ serveStatic: true });
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
