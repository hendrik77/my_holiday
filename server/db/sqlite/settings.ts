import type Database from 'better-sqlite3';
import type { Settings, SettingsUpdate } from '../../types';
import type { SettingsRepo } from '../types';
import { settingsFromRows, settingsUpdateEntries } from '../rows';

/**
 * SQLite settings repository over the key-value `settings` table. Mapping
 * and defaults shared with the PostgreSQL driver via rows.ts. Single global
 * row set until migration 002 (Phase 3) makes settings per-user.
 */
export function createSqliteSettingsRepo(db: Database.Database): SettingsRepo {
  function readSettings(): Settings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return settingsFromRows(rows);
  }

  return {
    // Contract passes userId; omitted here until the schema is user-scoped.
    async get(): Promise<Settings> {
      return readSettings();
    },

    async update(_userId: string, updates: SettingsUpdate): Promise<Settings> {
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const [key, value] of settingsUpdateEntries(updates)) {
        upsert.run(key, value);
      }
      return readSettings();
    },
  };
}
