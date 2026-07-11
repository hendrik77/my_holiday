import type { Pool } from 'pg';
import type { Settings, SettingsUpdate } from '../../types';
import type { SettingsRepo } from '../types';
import { settingsFromRows, settingsUpdateEntries } from '../rows';

/**
 * PostgreSQL settings repository over the key-value `settings` table.
 * Mapping and defaults shared with the SQLite driver via rows.ts.
 */
export function createPostgresSettingsRepo(pool: Pool): SettingsRepo {
  async function readSettings(): Promise<Settings> {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    return settingsFromRows(rows);
  }

  return {
    async get(): Promise<Settings> {
      return readSettings();
    },

    async update(_userId: string, updates: SettingsUpdate): Promise<Settings> {
      for (const [key, value] of settingsUpdateEntries(updates)) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value],
        );
      }
      return readSettings();
    },
  };
}
