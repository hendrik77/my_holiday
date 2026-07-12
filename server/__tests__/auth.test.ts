// @vitest-environment node
// jose/openid-client break under jsdom (cross-realm Uint8Array).
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDb, DEFAULT_USER_ID, type Db } from '../db';
import { loadConfig, type Config } from '../config';
import { createApp } from '../app';
import { createSessionToken } from '../auth/session';
import { requireRole } from '../auth/middleware';
import { startMockIdp, type MockIdp } from '../test/mock-idp';

const SECRET = 'test-secret-at-least-32-bytes-long!!';
const BASE_URL = 'http://127.0.0.1:3999';

let idp: MockIdp;

beforeAll(async () => {
  idp = await startMockIdp();
});

afterAll(async () => {
  await idp.close();
});

function oidcConfig(base: Config, adminEmails: string[] = []): Config {
  return {
    ...base,
    AUTH_MODE: 'oidc',
    OIDC_ISSUER_URL: idp.url,
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    PUBLIC_BASE_URL: BASE_URL,
    SESSION_SECRET: SECRET,
    ADMIN_EMAILS: adminEmails,
  };
}

describe('auth middleware matrix', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
  });

  afterEach(async () => {
    await db.close();
  });

  it('AUTH_MODE=none: requests act as the default user; /auth/me reports authMode none', async () => {
    const app = await createApp(db, { authMode: 'none', config: loadConfig({ DB_PATH: ':memory:' }) });
    const me = await request(app).get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(DEFAULT_USER_ID);
    expect(me.body.authMode).toBe('none');
  });

  it('AUTH_MODE=none: legacy API_TOKEN guard is preserved verbatim', async () => {
    const app = await createApp(db, { apiToken: 'legacy-token' });
    expect((await request(app).get('/api/v1/periods')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/periods').set('Authorization', 'Bearer legacy-token')).status,
    ).toBe(200);
  });

  it('AUTH_MODE=oidc: no cookie → 401; garbage cookie → 401', async () => {
    const app = await createApp(db, { authMode: 'oidc', config: oidcConfig(loadConfig({ DB_PATH: ':memory:' })) });
    expect((await request(app).get('/api/v1/periods')).status).toBe(401);
    expect((await request(app).get('/api/v1/periods').set('Cookie', 'mh_session=garbage')).status).toBe(401);
  });

  it('AUTH_MODE=oidc: a valid session cookie authenticates and scopes the request', async () => {
    const alice = await db.users.upsertFromIdP({ oidcSub: 'idp|alice', email: 'alice@example.com', name: 'Alice' });
    const app = await createApp(db, { authMode: 'oidc', config: oidcConfig(loadConfig({ DB_PATH: ':memory:' })) });

    const token = await createSessionToken(
      { sub: alice.id, role: alice.role, name: alice.name, email: alice.email },
      SECRET,
      900,
    );
    const res = await request(app)
      .post('/api/v1/periods')
      .set('Cookie', `mh_session=${token}`)
      .send({ startDate: '2026-09-01', endDate: '2026-09-05' });
    expect(res.status).toBe(201);
    expect(await db.periods.listAll(alice.id)).toHaveLength(1);
    expect(await db.periods.listAll(DEFAULT_USER_ID)).toHaveLength(0);
  });

  it('AUTH_MODE=oidc: an expired session cookie is rejected', async () => {
    const app = await createApp(db, { authMode: 'oidc', config: oidcConfig(loadConfig({ DB_PATH: ':memory:' })) });
    const expired = await createSessionToken(
      { sub: DEFAULT_USER_ID, role: 'admin', name: 'x', email: 'x@y.z' },
      SECRET,
      -10,
    );
    expect((await request(app).get('/api/v1/periods').set('Cookie', `mh_session=${expired}`)).status).toBe(401);
  });

  it('requireRole rejects insufficient roles with 403', async () => {
    const employee = await db.users.upsertFromIdP({ oidcSub: 'idp|emp', email: 'emp@example.com', name: 'Emp' });
    const mini = express();
    mini.use((req, _res, next) => {
      req.user = employee;
      next();
    });
    mini.get('/admin-only', requireRole('admin'), (_req, res) => {
      res.json({ ok: true });
    });
    expect((await request(mini).get('/admin-only')).status).toBe(403);
  });
});

describe('OIDC login flow (mock IdP)', () => {
  let db: Db;
  let app: express.Express;

  /** Run login → IdP → callback; returns the session/refresh cookies. */
  async function login(adminEmails: string[] = []): Promise<Record<string, string>> {
    app = await createApp(db, {
      authMode: 'oidc',
      config: oidcConfig(loadConfig({ DB_PATH: ':memory:' }), adminEmails),
    });

    const loginRes = await request(app).get('/api/v1/auth/login');
    expect(loginRes.status).toBe(302);
    const idpUrl = new URL(loginRes.headers.location);
    expect(idpUrl.origin).toBe(idp.url);
    expect(idpUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const oidcCookie = loginRes.headers['set-cookie']![0].split(';')[0];

    const idpRes = await fetch(idpUrl, { redirect: 'manual' });
    const callback = new URL(idpRes.headers.get('location')!);
    expect(callback.origin).toBe(BASE_URL);

    const cbRes = await request(app)
      .get(callback.pathname + callback.search)
      .set('Cookie', oidcCookie);
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toBe('/');

    const cookies: Record<string, string> = {};
    for (const c of cbRes.headers['set-cookie']!) {
      const [pair] = c.split(';');
      const [name, ...rest] = pair.split('=');
      cookies[name] = rest.join('=');
    }
    return cookies;
  }

  beforeEach(async () => {
    db = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
    idp.setUser({ sub: 'idp|carol', email: 'carol@example.com', name: 'Carol' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('completes login: upserts the user and sets session + refresh cookies', async () => {
    const cookies = await login();
    expect(cookies.mh_session).toBeTruthy();
    expect(cookies.mh_refresh).toBeTruthy();

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', `mh_session=${cookies.mh_session}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('carol@example.com');
    expect(me.body.role).toBe('employee');
    expect(me.body.authMode).toBe('oidc');
  });

  it('bootstraps admins from ADMIN_EMAILS', async () => {
    const cookies = await login(['carol@example.com']);
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', `mh_session=${cookies.mh_session}`);
    expect(me.body.role).toBe('admin');
  });

  it('rotates the refresh token and detects replay', async () => {
    const cookies = await login();

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `mh_refresh=${cookies.mh_refresh}`);
    expect(refresh.status).toBe(204);
    const newCookies = refresh.headers['set-cookie']!.join(';');
    expect(newCookies).toContain('mh_session=');
    expect(newCookies).toContain('mh_refresh=');

    // Replaying the pre-rotation token must fail (and kill the family).
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `mh_refresh=${cookies.mh_refresh}`);
    expect(replay.status).toBe(401);
  });

  it('logout revokes the refresh family', async () => {
    const cookies = await login();
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `mh_refresh=${cookies.mh_refresh}; mh_session=${cookies.mh_session}`);
    expect(logout.status).toBe(204);

    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `mh_refresh=${cookies.mh_refresh}`);
    expect(afterLogout.status).toBe(401);
  });
});
