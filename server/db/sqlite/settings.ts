import type Database from 'better-sqlite3';
import type { Settings, SettingsUpdate } from '../../types';
import type { SettingsRepo } from '../types';
import { settingsFromRows, settingsUpdateEntries } from '../rows';

/**
 * SQLite settings repository over the per-user key-value `user_settings`
 * table (migration 002). Mapping and defaults shared with the PostgreSQL
 * driver via rows.ts — users without stored rows read pure defaults, so no
 * per-user seeding step is needed.
 */
export function createSqliteSettingsRepo(db: Database.Database): SettingsRepo {
  function readSettings(userId: string): Settings {
    const rows = db
      .prepare('SELECT key, value FROM user_settings WHERE user_id = ?')
      .all(userId) as { key: string; value: string }[];
    return settingsFromRows(rows);
  }

  return {
    async get(userId: string): Promise<Settings> {
      return readSettings(userId);
    },

    async update(userId: string, updates: SettingsUpdate): Promise<Settings> {
      const upsert = db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)');
      for (const [key, value] of settingsUpdateEntries(updates)) {
        upsert.run(userId, key, value);
      }
      return readSettings(userId);
    },
  };
}
