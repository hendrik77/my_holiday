// @vitest-environment node
// jose/openid-client break under jsdom (cross-realm Uint8Array).
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDb, type Db } from '../db';
import { loadConfig, type Config } from '../config';
import { createApp } from '../app';
import { createSessionToken } from '../auth/session';
import { startMockIdp, type MockIdp } from '../test/mock-idp';

const SECRET = 'test-secret-at-least-32-bytes-long!!';

let idp: MockIdp;

beforeAll(async () => {
  idp = await startMockIdp();
});

afterAll(async () => {
  await idp.close();
});

describe('token management endpoints (/api/v1/tokens)', () => {
  let db: Db;
  let app: express.Express;
  let sessionCookie: string;

  beforeEach(async () => {
    db = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
    const base = loadConfig({ DB_PATH: ':memory:' });
    const config: Config = {
      ...base,
      AUTH_MODE: 'oidc',
      OIDC_ISSUER_URL: idp.url,
      OIDC_CLIENT_ID: 'test-client',
      OIDC_CLIENT_SECRET: 'test-secret',
      PUBLIC_BASE_URL: 'http://127.0.0.1:3999',
      SESSION_SECRET: SECRET,
      ADMIN_EMAILS: [],
    };
    app = await createApp(db, { authMode: 'oidc', config });

    const user = await db.users.upsertFromIdP({ oidcSub: 'idp|tok', email: 'tok@example.com', name: 'Tok' });
    const jwt = await createSessionToken({ sub: user.id, role: user.role, name: user.name, email: user.email }, SECRET, 900);
    sessionCookie = `mh_session=${jwt}`;
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates a token (raw value shown once) that immediately works as a bearer', async () => {
    const created = await request(app)
      .post('/api/v1/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'CLI on laptop', scope: 'full' });
    expect(created.status).toBe(201);
    expect(created.body.token).toMatch(/^mh_pat_/);
    expect(created.body.pat.name).toBe('CLI on laptop');
    expect(created.body.pat.tokenHash).toBeUndefined();

    const viaPat = await request(app).get('/api/v1/periods').set('Authorization', `Bearer ${created.body.token}`);
    expect(viaPat.status).toBe(200);
  });

  it('lists only metadata — never hashes — and revokes tokens', async () => {
    const created = await request(app)
      .post('/api/v1/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'temp', scope: 'read' });

    const list = await request(app).get('/api/v1/tokens').set('Cookie', sessionCookie);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('temp');
    expect(list.body[0].tokenPrefix).toMatch(/^mh_pat_/);
    expect(list.body[0].tokenHash).toBeUndefined();

    const del = await request(app).delete(`/api/v1/tokens/${list.body[0].id}`).set('Cookie', sessionCookie);
    expect(del.status).toBe(204);

    // Revoked → the raw token stops working.
    const viaPat = await request(app).get('/api/v1/periods').set('Authorization', `Bearer ${created.body.token}`);
    expect(viaPat.status).toBe(401);

    expect((await request(app).delete(`/api/v1/tokens/${list.body[0].id}`).set('Cookie', sessionCookie)).status).toBe(404);
  });

  it('validates input: bad scope and empty name are 400', async () => {
    expect(
      (await request(app).post('/api/v1/tokens').set('Cookie', sessionCookie).send({ name: 'x', scope: 'admin' }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/v1/tokens').set('Cookie', sessionCookie).send({ name: '', scope: 'full' }))
        .status,
    ).toBe(400);
  });

  it('rejects an expiresAt in the past or unreasonably far out (security M3)', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/tokens')
          .set('Cookie', sessionCookie)
          .send({ name: 'past', scope: 'full', expiresAt: '2000-01-01T00:00:00.000Z' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/tokens')
          .set('Cookie', sessionCookie)
          .send({ name: 'far', scope: 'full', expiresAt: '3000-01-01T00:00:00.000Z' })
      ).status,
    ).toBe(400);
  });

  it('caps the number of active tokens per user (security M1)', async () => {
    const user = (await db.users.findByOidcSub('idp|tok'))!;
    for (let i = 0; i < 25; i++) {
      await db.pats.create({
        userId: user.id,
        name: `t${i}`,
        tokenHash: `cap-hash-${i}`,
        tokenPrefix: 'mh_pat_capxx',
        scope: 'read',
        expiresAt: null,
      });
    }
    const res = await request(app)
      .post('/api/v1/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'one too many', scope: 'full' });
    expect(res.status).toBe(400);
  });

  it('rate limits token creation (security H1)', async () => {
    let limited = false;
    for (let i = 0; i < 31; i++) {
      const res = await request(app)
        .post('/api/v1/tokens')
        .set('Cookie', sessionCookie)
        .send({ name: `burst ${i}`, scope: 'read' });
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('a PAT cannot mint or manage PATs — session cookie only', async () => {
    const created = await request(app)
      .post('/api/v1/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'CLI', scope: 'full' });
    const bearer = `Bearer ${created.body.token}`;

    expect((await request(app).get('/api/v1/tokens').set('Authorization', bearer)).status).toBe(401);
    expect(
      (await request(app).post('/api/v1/tokens').set('Authorization', bearer).send({ name: 'evil', scope: 'full' }))
        .status,
    ).toBe(401);
  });

  it('does not exist in single-user mode', async () => {
    const noneDb = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
    const noneApp = await createApp(noneDb, { authMode: 'none', config: loadConfig({ DB_PATH: ':memory:' }) });
    expect((await request(noneApp).get('/api/v1/tokens')).status).toBe(404);
    await noneDb.close();
  });
});
