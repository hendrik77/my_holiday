import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDb, DEFAULT_USER_ID, type Db } from '../db';
import { loadConfig } from '../config';
import { createRouter } from '../routes';
import type { UserRow } from '../types';

/**
 * Route-level user scoping (Phase 3): every handler acts as the request's
 * authenticated user (req.user, set by upstream middleware — the OIDC
 * middleware in Phase 4), falling back to the synthetic default user in
 * single-user mode.
 */
describe('router user scoping', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
  });

  afterEach(async () => {
    await db.close();
  });

  function appActingAs(user?: UserRow): express.Express {
    const app = express();
    app.use(express.json());
    if (user) {
      app.use((req, _res, next) => {
        req.user = user;
        next();
      });
    }
    app.use('/api/v1', createRouter(db));
    return app;
  }

  it('writes periods as the user set by upstream middleware', async () => {
    const alice = await db.users.upsertFromIdP({ oidcSub: 'idp|alice', email: 'alice@example.com', name: 'Alice' });
    const app = appActingAs(alice);

    const res = await request(app)
      .post('/api/v1/periods')
      .send({ startDate: '2026-08-03', endDate: '2026-08-07' });
    expect(res.status).toBe(201);

    expect(await db.periods.listAll(alice.id)).toHaveLength(1);
    expect(await db.periods.listAll(DEFAULT_USER_ID)).toHaveLength(0);
  });

  it('only serves the acting user\'s periods and settings', async () => {
    const alice = await db.users.upsertFromIdP({ oidcSub: 'idp|alice', email: 'alice@example.com', name: 'Alice' });
    const bob = await db.users.upsertFromIdP({ oidcSub: 'idp|bob', email: 'bob@example.com', name: 'Bob' });
    await db.periods.create(alice.id, {
      startDate: '2026-08-03',
      endDate: '2026-08-07',
      note: 'Alice only',
      halfDay: false,
      type: 'urlaub',
    });
    await db.settings.update(alice.id, { totalDays: 25 });

    const asBob = appActingAs(bob);
    const periods = await request(asBob).get('/api/v1/periods');
    expect(periods.status).toBe(200);
    expect(periods.body).toEqual([]);

    const settings = await request(asBob).get('/api/v1/settings');
    expect(settings.body.totalDays).toBe(30); // Bob reads defaults, not Alice's 25
  });

  it('cannot update or delete another user\'s period through the API', async () => {
    const alice = await db.users.upsertFromIdP({ oidcSub: 'idp|alice', email: 'alice@example.com', name: 'Alice' });
    const bob = await db.users.upsertFromIdP({ oidcSub: 'idp|bob', email: 'bob@example.com', name: 'Bob' });
    const period = await db.periods.create(alice.id, {
      startDate: '2026-08-03',
      endDate: '2026-08-07',
      note: '',
      halfDay: false,
      type: 'urlaub',
    });

    const asBob = appActingAs(bob);
    expect((await request(asBob).put(`/api/v1/periods/${period.id}`).send({ note: 'stolen' })).status).toBe(404);
    expect((await request(asBob).delete(`/api/v1/periods/${period.id}`)).status).toBe(404);

    const [unchanged] = await db.periods.listAll(alice.id);
    expect(unchanged.note).toBe('');
  });

  it('falls back to the default user when no upstream middleware set req.user', async () => {
    const app = appActingAs(undefined);

    const res = await request(app)
      .post('/api/v1/periods')
      .send({ startDate: '2026-08-03', endDate: '2026-08-07' });
    expect(res.status).toBe(201);

    expect(await db.periods.listAll(DEFAULT_USER_ID)).toHaveLength(1);
  });
});
