import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Db } from '../db/types';
import { DEFAULT_USER_ID } from '../db/constants';

/**
 * Shared repository contract suite (ADR-0006).
 *
 * Every Db backend (SQLite today, PostgreSQL in Phase 2) must pass this
 * suite unchanged — it is the executable definition of the repository
 * interface. Assertions mirror the pre-v3 `db.test.ts` behavior so the
 * abstraction provably preserves single-user semantics. Since migration 002
 * (Phase 3) the schema is user-scoped: rows belong to real `users` rows and
 * the suite also verifies per-user isolation.
 */
export function describeRepoContract(name: string, makeDb: () => Promise<Db>): void {
  // The synthetic single-user identity — inserted by migration 002, so it
  // always exists and satisfies the periods.user_id foreign key.
  const USER = DEFAULT_USER_ID;

  describe(`repo contract: ${name}`, () => {
    let db: Db;

    beforeEach(async () => {
      db = await makeDb();
    });

    afterEach(async () => {
      await db.close();
    });

    describe('migrate', () => {
      it('is idempotent — running again applies nothing and keeps data', async () => {
        await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: 'Sommerurlaub',
          halfDay: false,
          type: 'urlaub',
        });
        await db.migrate();
        expect(await db.periods.listAll(USER)).toHaveLength(1);
      });
    });

    describe('periods', () => {
      it('returns an empty array when no periods exist', async () => {
        expect(await db.periods.listByYear(USER, 2026)).toEqual([]);
        expect(await db.periods.listAll(USER)).toEqual([]);
      });

      it('creates a period and returns it fully populated', async () => {
        const period = await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: 'Sommerurlaub',
          halfDay: false,
          type: 'urlaub',
        });
        expect(period.id).toBeDefined();
        expect(period.startDate).toBe('2026-07-01');
        expect(period.endDate).toBe('2026-07-15');
        expect(period.note).toBe('Sommerurlaub');
        expect(period.halfDay).toBe(false);
        expect(period.type).toBe('urlaub');
        expect(period.changedAt).toBeDefined();
      });

      it('defaults type to urlaub when not provided', async () => {
        const period = await db.periods.create(USER, {
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          note: '',
          halfDay: false,
        });
        expect(period.type).toBe('urlaub');
      });

      it('round-trips a created period through listAll', async () => {
        const created = await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: 'Persistenz',
          halfDay: true,
          type: 'bildungsurlaub',
        });
        const all = await db.periods.listAll(USER);
        expect(all).toEqual([created]);
      });

      it('filters by year including periods spanning the year boundary', async () => {
        await db.periods.create(USER, { startDate: '2025-12-20', endDate: '2026-01-05', note: '', halfDay: false, type: 'urlaub' });
        await db.periods.create(USER, { startDate: '2026-06-01', endDate: '2026-06-05', note: '', halfDay: false, type: 'urlaub' });
        await db.periods.create(USER, { startDate: '2027-01-01', endDate: '2027-01-03', note: '', halfDay: false, type: 'urlaub' });

        expect(await db.periods.listByYear(USER, 2026)).toHaveLength(2);
        expect(await db.periods.listAll(USER)).toHaveLength(3);
      });

      it('sorts listAll and listByYear by start date', async () => {
        await db.periods.create(USER, { startDate: '2026-09-01', endDate: '2026-09-05', note: '', halfDay: false, type: 'urlaub' });
        await db.periods.create(USER, { startDate: '2026-02-01', endDate: '2026-02-05', note: '', halfDay: false, type: 'urlaub' });

        const all = await db.periods.listAll(USER);
        expect(all.map((p) => p.startDate)).toEqual(['2026-02-01', '2026-09-01']);
      });

      it('updates fields and refreshes changedAt', async () => {
        const created = await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: '',
          halfDay: false,
          type: 'urlaub',
        });
        await new Promise((r) => setTimeout(r, 2));

        const updated = await db.periods.update(USER, created.id, { note: 'Updated note' });
        expect(updated).not.toBeNull();
        expect(updated!.note).toBe('Updated note');
        expect(updated!.startDate).toBe('2026-07-01'); // unchanged
        expect(updated!.changedAt).not.toBe(created.changedAt);
      });

      it('persists updates (visible on re-read)', async () => {
        const created = await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: '',
          halfDay: false,
          type: 'urlaub',
        });
        await db.periods.update(USER, created.id, { halfDay: true, endDate: '2026-07-20' });

        const [reread] = await db.periods.listAll(USER);
        expect(reread.halfDay).toBe(true);
        expect(reread.endDate).toBe('2026-07-20');
      });

      it('returns null when updating a non-existent period', async () => {
        expect(await db.periods.update(USER, 'nonexistent', { note: 'x' })).toBeNull();
      });

      it('deletes a period', async () => {
        const created = await db.periods.create(USER, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: '',
          halfDay: false,
          type: 'urlaub',
        });
        expect(await db.periods.remove(USER, created.id)).toBe(true);
        expect(await db.periods.listByYear(USER, 2026)).toHaveLength(0);
      });

      it('returns false when deleting a non-existent period', async () => {
        expect(await db.periods.remove(USER, 'nonexistent')).toBe(false);
      });
    });

    describe('settings', () => {
      it('returns seeded defaults', async () => {
        const settings = await db.settings.get(USER);
        expect(settings.totalDays).toBe(30);
        expect(settings.state).toBe('HE');
        expect(settings.carryOverDays).toBe(0);
        expect(settings.carryOverDeadline).toBe('03-31');
        expect(settings.carryOverMaxDays).toBeNull();
        expect(settings.employmentStartDate).toBe('');
        expect(settings.employmentEndDate).toBe('');
        expect(settings.bildungsUrlaubDays).toBe(0);
      });

      it('updates a single setting and leaves the rest untouched', async () => {
        await db.settings.update(USER, { totalDays: 28 });
        const settings = await db.settings.get(USER);
        expect(settings.totalDays).toBe(28);
        expect(settings.state).toBe('HE');
      });

      it('updates multiple settings at once and returns the merged result', async () => {
        const settings = await db.settings.update(USER, {
          totalDays: 25,
          state: 'BY',
          carryOverDeadline: '06-30',
          employmentStartDate: '2020-01-01',
        });
        expect(settings.totalDays).toBe(25);
        expect(settings.state).toBe('BY');
        expect(settings.carryOverDeadline).toBe('06-30');
        expect(settings.employmentStartDate).toBe('2020-01-01');
      });

      it('handles nullable carryOverMaxDays round-trips', async () => {
        await db.settings.update(USER, { carryOverMaxDays: 10 });
        expect((await db.settings.get(USER)).carryOverMaxDays).toBe(10);

        await db.settings.update(USER, { carryOverMaxDays: null });
        expect((await db.settings.get(USER)).carryOverMaxDays).toBeNull();
      });
    });

    describe('users', () => {
      it('migration 002 inserted the synthetic default user as admin', async () => {
        const user = await db.users.findById(DEFAULT_USER_ID);
        expect(user).not.toBeNull();
        expect(user!.email).toBe('local@my-holiday.invalid');
        expect(user!.role).toBe('admin');
        expect(user!.oidcSub).toBeNull();
      });

      it('returns null for unknown ids and oidc subs', async () => {
        expect(await db.users.findById('nonexistent')).toBeNull();
        expect(await db.users.findByOidcSub('nonexistent')).toBeNull();
      });

      it('upsertFromIdP creates a new employee on first login', async () => {
        const user = await db.users.upsertFromIdP({
          oidcSub: 'idp|alice',
          email: 'alice@example.com',
          name: 'Alice',
        });
        expect(user.id).toBeDefined();
        expect(user.id).not.toBe(DEFAULT_USER_ID);
        expect(user.oidcSub).toBe('idp|alice');
        expect(user.email).toBe('alice@example.com');
        expect(user.name).toBe('Alice');
        expect(user.role).toBe('employee');
        expect(user.managerId).toBeNull();

        expect(await db.users.findByOidcSub('idp|alice')).toEqual(user);
      });

      it('upsertFromIdP refreshes email/name but keeps id and admin-managed fields', async () => {
        const first = await db.users.upsertFromIdP({
          oidcSub: 'idp|bob',
          email: 'bob@example.com',
          name: 'Bob',
        });
        await db.users.updateProfile(first.id, { role: 'manager', team: 'Platform' });

        const second = await db.users.upsertFromIdP({
          oidcSub: 'idp|bob',
          email: 'robert@example.com',
          name: 'Robert',
        });
        expect(second.id).toBe(first.id);
        expect(second.email).toBe('robert@example.com');
        expect(second.name).toBe('Robert');
        expect(second.role).toBe('manager');
        expect(second.team).toBe('Platform');
      });

      it('stores emails lowercased so casing cannot split one identity into two rows', async () => {
        const user = await db.users.upsertFromIdP({
          oidcSub: 'idp|mixed',
          email: 'MiXeD@Example.COM',
          name: 'Mixed',
        });
        expect(user.email).toBe('mixed@example.com');
      });

      it('listAll returns every user including the default user', async () => {
        await db.users.upsertFromIdP({ oidcSub: 'idp|a', email: 'a@example.com', name: 'A' });
        await db.users.upsertFromIdP({ oidcSub: 'idp|b', email: 'b@example.com', name: 'B' });

        const all = await db.users.listAll();
        expect(all).toHaveLength(3);
        expect(all.map((u) => u.email)).toContain('local@my-holiday.invalid');
      });

      it('updateProfile changes role/team/managerId and returns null for unknown users', async () => {
        const manager = await db.users.upsertFromIdP({ oidcSub: 'idp|m', email: 'm@example.com', name: 'M' });
        const report = await db.users.upsertFromIdP({ oidcSub: 'idp|r', email: 'r@example.com', name: 'R' });

        const updated = await db.users.updateProfile(report.id, {
          team: 'Support',
          managerId: manager.id,
        });
        expect(updated!.team).toBe('Support');
        expect(updated!.managerId).toBe(manager.id);
        expect(updated!.updatedAt).toBeDefined();

        expect(await db.users.updateProfile('nonexistent', { team: 'X' })).toBeNull();
      });

      it('listDirectReports returns exactly the users managed by the given id', async () => {
        const manager = await db.users.upsertFromIdP({ oidcSub: 'idp|mgr', email: 'mgr@example.com', name: 'Mgr' });
        const r1 = await db.users.upsertFromIdP({ oidcSub: 'idp|r1', email: 'r1@example.com', name: 'R1' });
        const r2 = await db.users.upsertFromIdP({ oidcSub: 'idp|r2', email: 'r2@example.com', name: 'R2' });
        await db.users.upsertFromIdP({ oidcSub: 'idp|other', email: 'other@example.com', name: 'Other' });

        await db.users.updateProfile(r1.id, { managerId: manager.id });
        await db.users.updateProfile(r2.id, { managerId: manager.id });

        const reports = await db.users.listDirectReports(manager.id);
        expect(reports.map((u) => u.email).sort()).toEqual(['r1@example.com', 'r2@example.com']);
      });
    });

    describe('refresh tokens (migration 003)', () => {
      const FUTURE = '2099-01-01T00:00:00.000Z';

      it('stores a token and finds it by hash', async () => {
        const row = await db.refreshTokens.create({
          userId: USER,
          tokenHash: 'hash-a',
          familyId: 'fam-1',
          expiresAt: FUTURE,
        });
        expect(row.id).toBeDefined();
        expect(row.rotatedAt).toBeNull();
        expect(row.revokedAt).toBeNull();

        expect(await db.refreshTokens.findByHash('hash-a')).toEqual(row);
        expect(await db.refreshTokens.findByHash('nonexistent')).toBeNull();
      });

      it('markRotated claims the token exactly once (atomic)', async () => {
        const row = await db.refreshTokens.create({
          userId: USER,
          tokenHash: 'hash-b',
          familyId: 'fam-1',
          expiresAt: FUTURE,
        });
        expect(await db.refreshTokens.markRotated(row.id)).toBe(true);
        // The second claim loses: rotated_at is already set.
        expect(await db.refreshTokens.markRotated(row.id)).toBe(false);

        const rotated = await db.refreshTokens.findByHash('hash-b');
        expect(rotated!.rotatedAt).not.toBeNull();
        expect(rotated!.revokedAt).toBeNull();
      });

      it('revokeFamily revokes every token of the family and reports the count', async () => {
        await db.refreshTokens.create({ userId: USER, tokenHash: 'f1-a', familyId: 'fam-x', expiresAt: FUTURE });
        await db.refreshTokens.create({ userId: USER, tokenHash: 'f1-b', familyId: 'fam-x', expiresAt: FUTURE });
        await db.refreshTokens.create({ userId: USER, tokenHash: 'other', familyId: 'fam-y', expiresAt: FUTURE });

        expect(await db.refreshTokens.revokeFamily('fam-x')).toBe(2);

        expect((await db.refreshTokens.findByHash('f1-a'))!.revokedAt).not.toBeNull();
        expect((await db.refreshTokens.findByHash('f1-b'))!.revokedAt).not.toBeNull();
        expect((await db.refreshTokens.findByHash('other'))!.revokedAt).toBeNull();
      });

      it('deleteExpired removes only expired tokens', async () => {
        await db.refreshTokens.create({
          userId: USER,
          tokenHash: 'old',
          familyId: 'fam-old',
          expiresAt: '2000-01-01T00:00:00.000Z',
        });
        await db.refreshTokens.create({ userId: USER, tokenHash: 'new', familyId: 'fam-new', expiresAt: FUTURE });

        expect(await db.refreshTokens.deleteExpired()).toBe(1);
        expect(await db.refreshTokens.findByHash('old')).toBeNull();
        expect(await db.refreshTokens.findByHash('new')).not.toBeNull();
      });
    });

    describe('org settings (migration 005)', () => {
      it('seeds privacyLevel=dates and round-trips updates', async () => {
        expect(await db.orgSettings.getPrivacyLevel()).toBe('dates');

        await db.orgSettings.setPrivacyLevel('dates_notes');
        expect(await db.orgSettings.getPrivacyLevel()).toBe('dates_notes');

        await db.orgSettings.setPrivacyLevel('nothing');
        expect(await db.orgSettings.getPrivacyLevel()).toBe('nothing');
      });
    });

    describe('personal access tokens (migration 004)', () => {
      const FUTURE = '2099-01-01T00:00:00.000Z';

      it('creates a PAT and finds it by hash', async () => {
        const pat = await db.pats.create({
          userId: USER,
          name: 'CLI on laptop',
          tokenHash: 'pat-hash-a',
          tokenPrefix: 'mh_pat_abc1',
          scope: 'full',
          expiresAt: null,
        });
        expect(pat.id).toBeDefined();
        expect(pat.scope).toBe('full');
        expect(pat.lastUsedAt).toBeNull();
        expect(pat.revokedAt).toBeNull();

        expect(await db.pats.findByHash('pat-hash-a')).toEqual(pat);
        expect(await db.pats.findByHash('unknown')).toBeNull();
      });

      it('lists only the owning user\'s tokens', async () => {
        const other = await db.users.upsertFromIdP({ oidcSub: 'idp|pat-other', email: 'pat-other@example.com', name: 'O' });
        await db.pats.create({ userId: USER, name: 'one', tokenHash: 'h1', tokenPrefix: 'mh_pat_1111', scope: 'full', expiresAt: null });
        await db.pats.create({ userId: other.id, name: 'foreign', tokenHash: 'h2', tokenPrefix: 'mh_pat_2222', scope: 'read', expiresAt: null });

        const mine = await db.pats.listForUser(USER);
        expect(mine).toHaveLength(1);
        expect(mine[0].name).toBe('one');
      });

      it('revoke only works for the owning user and is idempotent', async () => {
        const other = await db.users.upsertFromIdP({ oidcSub: 'idp|pat-rev', email: 'pat-rev@example.com', name: 'R' });
        const pat = await db.pats.create({ userId: USER, name: 'x', tokenHash: 'h3', tokenPrefix: 'mh_pat_3333', scope: 'full', expiresAt: null });

        expect(await db.pats.revoke(other.id, pat.id)).toBe(false); // not yours
        expect(await db.pats.revoke(USER, pat.id)).toBe(true);
        expect(await db.pats.revoke(USER, pat.id)).toBe(false); // already revoked

        expect((await db.pats.findByHash('h3'))!.revokedAt).not.toBeNull();
      });

      it('touchLastUsed stamps last_used_at', async () => {
        const pat = await db.pats.create({ userId: USER, name: 'y', tokenHash: 'h4', tokenPrefix: 'mh_pat_4444', scope: 'read', expiresAt: FUTURE });
        await db.pats.touchLastUsed(pat.id);
        expect((await db.pats.findByHash('h4'))!.lastUsedAt).not.toBeNull();
      });
    });

    describe('per-user isolation (migration 002)', () => {
      let userA: string;
      let userB: string;

      beforeEach(async () => {
        userA = (await db.users.upsertFromIdP({ oidcSub: 'idp|iso-a', email: 'iso-a@example.com', name: 'IsoA' })).id;
        userB = (await db.users.upsertFromIdP({ oidcSub: 'idp|iso-b', email: 'iso-b@example.com', name: 'IsoB' })).id;
      });

      it('periods are only visible to their owner', async () => {
        await db.periods.create(userA, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: 'A only',
          halfDay: false,
          type: 'urlaub',
        });

        expect(await db.periods.listAll(userA)).toHaveLength(1);
        expect(await db.periods.listAll(userB)).toHaveLength(0);
        expect(await db.periods.listByYear(userB, 2026)).toHaveLength(0);
        expect(await db.periods.listAll(USER)).toHaveLength(0);
      });

      it('update and remove cannot touch another user\'s period', async () => {
        const period = await db.periods.create(userA, {
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          note: '',
          halfDay: false,
          type: 'urlaub',
        });

        expect(await db.periods.update(userB, period.id, { note: 'stolen' })).toBeNull();
        expect(await db.periods.remove(userB, period.id)).toBe(false);

        const [unchanged] = await db.periods.listAll(userA);
        expect(unchanged.note).toBe('');
      });

      it('settings are stored per user', async () => {
        await db.settings.update(userA, { totalDays: 25, state: 'BY' });

        const a = await db.settings.get(userA);
        const b = await db.settings.get(userB);
        expect(a.totalDays).toBe(25);
        expect(a.state).toBe('BY');
        // B never wrote anything — reads fall back to defaults.
        expect(b.totalDays).toBe(30);
        expect(b.state).toBe('HE');
      });

      it('the default user keeps the seeded settings copied by migration 002', async () => {
        const settings = await db.settings.get(USER);
        expect(settings.totalDays).toBe(30);
        expect(settings.state).toBe('HE');
      });
    });
  });
}
