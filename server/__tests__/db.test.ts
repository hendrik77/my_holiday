import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb, getAllPeriods, getPeriodsByYear, createPeriod, updatePeriod, deletePeriod, getSettings, updateSettings } from '../db';

const TEST_DB_PATH = ':memory:';

// Override the module's db before each test by setting up a fresh in-memory db
let db: Database.Database;

function createTestDb() {
  db = new Database(TEST_DB_PATH);
  initDb(db);
  return db;
}

describe('db', () => {
  let testDb: Database.Database;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('initDb', () => {
    it('creates the periods table', () => {
      const row = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='periods'").get() as { name: string } | undefined;
      expect(row).toBeDefined();
    });

    it('creates the settings table', () => {
      const row = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get() as { name: string } | undefined;
      expect(row).toBeDefined();
    });

    it('inserts default settings on first init', () => {
      const settings = getSettings(testDb);
      expect(settings.totalDays).toBe(30);
      expect(settings.state).toBe('HE');
      expect(settings.carryOverDays).toBe(0);
    });
  });

  describe('periods CRUD', () => {
    it('returns empty array when no periods exist', () => {
      const periods = getPeriodsByYear(testDb, 2026);
      expect(periods).toEqual([]);
    });

    it('creates a period and returns it', () => {
      const period = createPeriod(testDb, {
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

    it('gets periods filtered by year', () => {
      createPeriod(testDb, { startDate: '2025-12-20', endDate: '2026-01-05', note: '', halfDay: false, type: 'urlaub' });
      createPeriod(testDb, { startDate: '2026-06-01', endDate: '2026-06-05', note: '', halfDay: false, type: 'urlaub' });
      createPeriod(testDb, { startDate: '2027-01-01', endDate: '2027-01-03', note: '', halfDay: false, type: 'urlaub' });

      const periods2026 = getPeriodsByYear(testDb, 2026);
      expect(periods2026).toHaveLength(2);
    });

    it('gets all periods', () => {
      createPeriod(testDb, { startDate: '2025-12-20', endDate: '2026-01-05', note: '', halfDay: false, type: 'urlaub' });
      createPeriod(testDb, { startDate: '2026-06-01', endDate: '2026-06-05', note: '', halfDay: false, type: 'urlaub' });

      const all = getAllPeriods(testDb);
      expect(all).toHaveLength(2);
    });

    it('updates a period and updates changedAt', async () => {
      const created = createPeriod(testDb, { startDate: '2026-07-01', endDate: '2026-07-15', note: '', halfDay: false, type: 'urlaub' });
      const originalChangedAt = created.changedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 2));
      const updated = updatePeriod(testDb, created.id, { note: 'Updated note' });
      expect(updated).not.toBeNull();
      expect(updated!.note).toBe('Updated note');
      expect(updated!.startDate).toBe('2026-07-01'); // unchanged
      expect(updated!.changedAt).not.toBe(originalChangedAt);
    });

    it('returns null when updating non-existent period', () => {
      const result = updatePeriod(testDb, 'nonexistent', { note: 'test' });
      expect(result).toBeNull();
    });

    it('deletes a period', () => {
      const created = createPeriod(testDb, { startDate: '2026-07-01', endDate: '2026-07-15', note: '', halfDay: false, type: 'urlaub' });
      const deleted = deletePeriod(testDb, created.id);
      expect(deleted).toBe(true);

      const periods = getPeriodsByYear(testDb, 2026);
      expect(periods).toHaveLength(0);
    });

    it('returns false when deleting non-existent period', () => {
      const result = deletePeriod(testDb, 'nonexistent');
      expect(result).toBe(false);
    });

    it('defaults type to urlaub when not provided', () => {
      const period = createPeriod(testDb, { startDate: '2026-08-01', endDate: '2026-08-05', note: '', halfDay: false });
      expect(period.type).toBe('urlaub');
    });
  });

  describe('settings CRUD', () => {
    it('returns default settings', () => {
      const settings = getSettings(testDb);
      expect(settings.totalDays).toBe(30);
      expect(settings.state).toBe('HE');
      expect(settings.carryOverDays).toBe(0);
      expect(settings.carryOverDeadline).toBe('03-31');
      expect(settings.carryOverMaxDays).toBeNull();
      expect(settings.employmentStartDate).toBe('');
      expect(settings.employmentEndDate).toBe('');
      expect(settings.bildungsUrlaubDays).toBe(0);
    });

    it('updates a single setting', () => {
      updateSettings(testDb, { totalDays: 28 });
      const settings = getSettings(testDb);
      expect(settings.totalDays).toBe(28);
      expect(settings.state).toBe('HE'); // unchanged
    });

    it('updates multiple settings at once', () => {
      updateSettings(testDb, {
        totalDays: 25,
        state: 'BY',
        carryOverDeadline: '06-30',
        employmentStartDate: '2020-01-01',
      });
      const settings = getSettings(testDb);
      expect(settings.totalDays).toBe(25);
      expect(settings.state).toBe('BY');
      expect(settings.carryOverDeadline).toBe('06-30');
      expect(settings.employmentStartDate).toBe('2020-01-01');
    });

    it('handles null carryOverMaxDays', () => {
      updateSettings(testDb, { carryOverMaxDays: 10 });
      expect(getSettings(testDb).carryOverMaxDays).toBe(10);

      updateSettings(testDb, { carryOverMaxDays: null });
      expect(getSettings(testDb).carryOverMaxDays).toBeNull();
    });
  });
});
