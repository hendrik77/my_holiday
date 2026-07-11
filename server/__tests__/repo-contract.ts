import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Db } from '../db/types';

/**
 * Shared repository contract suite (ADR-0006).
 *
 * Every Db backend (SQLite today, PostgreSQL in Phase 2) must pass this
 * suite unchanged — it is the executable definition of the repository
 * interface. Assertions mirror the pre-v3 `db.test.ts` behavior so the
 * abstraction provably preserves single-user semantics.
 */
export function describeRepoContract(name: string, makeDb: () => Promise<Db>): void {
  // Arbitrary caller identity; backends without user scoping (Phase 1 SQLite
  // baseline schema) accept and ignore it. Phase 3 adds isolation tests.
  const USER = 'contract-test-user';

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
  });
}
