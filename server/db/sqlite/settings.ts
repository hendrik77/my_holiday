import type Database from 'better-sqlite3';
import type { Settings, SettingsUpdate } from '../../types';
import type { SettingsRepo } from '../types';

/**
 * SQLite settings repository over the key-value `settings` table. SQL moved
 * unchanged from the pre-v3 `server/db.ts`; missing keys fall back to
 * defaults on read. Single global row set until migration 002 (Phase 3)
 * makes settings per-user.
 */
export function createSqliteSettingsRepo(db: Database.Database): SettingsRepo {
  function readSettings(): Settings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      totalDays: parseInt(map.get('totalDays') || '30', 10),
      state: map.get('state') || 'HE',
      carryOverDays: parseInt(map.get('carryOverDays') || '0', 10),
      carryOverDeadline: map.get('carryOverDeadline') || '03-31',
      carryOverMaxDays: map.get('carryOverMaxDays') ? parseInt(map.get('carryOverMaxDays')!, 10) : null,
      employmentStartDate: map.get('employmentStartDate') || '',
      employmentEndDate: map.get('employmentEndDate') || '',
      bildungsUrlaubDays: parseInt(map.get('bildungsUrlaubDays') || '0', 10),
    };
  }

  return {
    // Contract passes userId; omitted here until the schema is user-scoped.
    async get(): Promise<Settings> {
      return readSettings();
    },

    async update(_userId: string, updates: SettingsUpdate): Promise<Settings> {
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

      if (updates.totalDays !== undefined) upsert.run('totalDays', String(updates.totalDays));
      if (updates.state !== undefined) upsert.run('state', updates.state);
      if (updates.carryOverDays !== undefined) upsert.run('carryOverDays', String(updates.carryOverDays));
      if (updates.carryOverDeadline !== undefined) upsert.run('carryOverDeadline', updates.carryOverDeadline);
      if (updates.carryOverMaxDays !== undefined)
        upsert.run('carryOverMaxDays', updates.carryOverMaxDays === null ? '' : String(updates.carryOverMaxDays));
      if (updates.employmentStartDate !== undefined) upsert.run('employmentStartDate', updates.employmentStartDate);
      if (updates.employmentEndDate !== undefined) upsert.run('employmentEndDate', updates.employmentEndDate);
      if (updates.bildungsUrlaubDays !== undefined) upsert.run('bildungsUrlaubDays', String(updates.bildungsUrlaubDays));

      return readSettings();
    },
  };
}
