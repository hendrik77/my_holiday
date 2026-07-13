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
import type { UserRow } from '../types';

const SECRET = 'test-secret-at-least-32-bytes-long!!';

let idp: MockIdp;

beforeAll(async () => {
  idp = await startMockIdp();
});

afterAll(async () => {
  await idp.close();
});

describe('team, org, and admin endpoints', () => {
  let db: Db;
  let app: express.Express;
  let manager: UserRow;
  let report1: UserRow;
  let admin: UserRow;
  let outsider: UserRow;

  async function cookieFor(user: UserRow): Promise<string> {
    const jwt = await createSessionToken(
      { sub: user.id, role: user.role, name: user.name, email: user.email },
      SECRET,
      900,
    );
    return `mh_session=${jwt}`;
  }

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

    manager = await db.users.upsertFromIdP({ oidcSub: 'idp|mgr', email: 'mgr@example.com', name: 'Mgr' });
    manager = (await db.users.updateProfile(manager.id, { role: 'manager' }))!;
    report1 = await db.users.upsertFromIdP({ oidcSub: 'idp|r1', email: 'r1@example.com', name: 'R1' });
    report1 = (await db.users.updateProfile(report1.id, { managerId: manager.id }))!;
    admin = await db.users.upsertFromIdP({ oidcSub: 'idp|adm', email: 'adm@example.com', name: 'Adm' });
    admin = (await db.users.updateProfile(admin.id, { role: 'admin' }))!;
    outsider = await db.users.upsertFromIdP({ oidcSub: 'idp|out', email: 'out@example.com', name: 'Out' });

    await db.periods.create(report1.id, {
      startDate: '2026-07-06',
      endDate: '2026-07-10',
      note: 'private note',
      halfDay: false,
      type: 'urlaub',
    });
    await db.periods.create(outsider.id, {
      startDate: '2026-07-13',
      endDate: '2026-07-17',
      note: 'outsider note',
      halfDay: false,
      type: 'urlaub',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe('GET /api/v1/team/periods', () => {
    it('rejects employees with 403', async () => {
      const res = await request(app).get('/api/v1/team/periods?year=2026').set('Cookie', await cookieFor(outsider));
      expect(res.status).toBe(403);
    });

    it('managers see exactly their direct reports, dates visible, notes stripped by default', async () => {
      const res = await request(app).get('/api/v1/team/periods?year=2026').set('Cookie', await cookieFor(manager));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].user).toMatchObject({ id: report1.id, name: 'R1' });
      expect(res.body[0].periods).toHaveLength(1);
      expect(res.body[0].periods[0].startDate).toBe('2026-07-06');
      expect(res.body[0].periods[0].note).toBe(''); // privacyLevel 'dates'
    });

    it('managers still see dates when privacyLevel is nothing (role right)', async () => {
      await db.orgSettings.setPrivacyLevel('nothing');
      const res = await request(app).get('/api/v1/team/periods?year=2026').set('Cookie', await cookieFor(manager));
      expect(res.status).toBe(200);
      expect(res.body[0].periods[0].startDate).toBe('2026-07-06');
      expect(res.body[0].periods[0].note).toBe('');
    });

    it('notes appear only at privacyLevel dates_notes', async () => {
      await db.orgSettings.setPrivacyLevel('dates_notes');
      const res = await request(app).get('/api/v1/team/periods?year=2026').set('Cookie', await cookieFor(manager));
      expect(res.body[0].periods[0].note).toBe('private note');
    });

    it('admins see every user except themselves', async () => {
      const res = await request(app).get('/api/v1/team/periods?year=2026').set('Cookie', await cookieFor(admin));
      expect(res.status).toBe(200);
      const ids = res.body.map((row: { user: { id: string } }) => row.user.id);
      expect(ids).toContain(report1.id);
      expect(ids).toContain(outsider.id);
      expect(ids).not.toContain(admin.id);
    });
  });

  describe('org settings endpoints', () => {
    it('GET/PUT are admin-only and validate the level', async () => {
      expect(
        (await request(app).get('/api/v1/org/settings').set('Cookie', await cookieFor(manager))).status,
      ).toBe(403);

      const get = await request(app).get('/api/v1/org/settings').set('Cookie', await cookieFor(admin));
      expect(get.status).toBe(200);
      expect(get.body.privacyLevel).toBe('dates');

      expect(
        (
          await request(app)
            .put('/api/v1/org/settings')
            .set('Cookie', await cookieFor(admin))
            .send({ privacyLevel: 'everything' })
        ).status,
      ).toBe(400);

      const put = await request(app)
        .put('/api/v1/org/settings')
        .set('Cookie', await cookieFor(admin))
        .send({ privacyLevel: 'dates_notes' });
      expect(put.status).toBe(200);
      expect(await db.orgSettings.getPrivacyLevel()).toBe('dates_notes');
    });
  });

  it('team/org/admin endpoints do not exist in single-user mode (security review HIGH)', async () => {
    const noneDb = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
    const noneApp = await createApp(noneDb, { authMode: 'none', config: loadConfig({ DB_PATH: ':memory:' }) });
    for (const path of ['/api/v1/team/periods', '/api/v1/org/settings', '/api/v1/admin/users']) {
      expect((await request(noneApp).get(path)).status).toBe(404);
    }
    await noneDb.close();
  });

  describe('admin user management', () => {
    it('GET /api/v1/admin/users is admin-only and lists everyone', async () => {
      expect((await request(app).get('/api/v1/admin/users').set('Cookie', await cookieFor(manager))).status).toBe(403);

      const res = await request(app).get('/api/v1/admin/users').set('Cookie', await cookieFor(admin));
      expect(res.status).toBe(200);
      // manager, report1, admin, outsider + synthetic default user
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      expect(res.body[0].oidcSub).toBeUndefined(); // no IdP internals leaked
    });

    it('PUT /api/v1/admin/users/:id updates role/team/manager with validation', async () => {
      const promote = await request(app)
        .put(`/api/v1/admin/users/${outsider.id}`)
        .set('Cookie', await cookieFor(admin))
        .send({ role: 'manager', team: 'Support' });
      expect(promote.status).toBe(200);
      expect(promote.body.role).toBe('manager');
      expect(promote.body.team).toBe('Support');

      expect(
        (
          await request(app)
            .put(`/api/v1/admin/users/${outsider.id}`)
            .set('Cookie', await cookieFor(admin))
            .send({ role: 'superuser' })
        ).status,
      ).toBe(400);

      expect(
        (
          await request(app)
            .put(`/api/v1/admin/users/${outsider.id}`)
            .set('Cookie', await cookieFor(admin))
            .send({ managerId: outsider.id })
        ).status,
      ).toBe(400); // cannot be their own manager

      expect(
        (
          await request(app)
            .put('/api/v1/admin/users/nonexistent')
            .set('Cookie', await cookieFor(admin))
            .send({ team: 'X' })
        ).status,
      ).toBe(404);

      expect(
        (
          await request(app)
            .put(`/api/v1/admin/users/${outsider.id}`)
            .set('Cookie', await cookieFor(manager))
            .send({ team: 'X' })
        ).status,
      ).toBe(403);
    });

    it('refuses to demote the last remaining admin (security review MEDIUM)', async () => {
      // `admin` is the only admin (default user is admin too, so demote it first).
      const defaultUser = (await db.users.listAll()).find((u) => u.role === 'admin' && u.id !== admin.id)!;
      await db.users.updateProfile(defaultUser.id, { role: 'employee' });

      const res = await request(app)
        .put(`/api/v1/admin/users/${admin.id}`)
        .set('Cookie', await cookieFor(admin))
        .send({ role: 'employee' });
      expect(res.status).toBe(400);
      expect((await db.users.findById(admin.id))!.role).toBe('admin');
    });
  });
});
