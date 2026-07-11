import type { Pool } from 'pg';
import type { Settings, SettingsUpdate } from '../../types';
import type { SettingsRepo } from '../types';
import { settingsFromRows, settingsUpdateEntries } from '../rows';

/**
 * PostgreSQL settings repository over the per-user key-value `user_settings`
 * table (migration 002). Mapping and defaults shared with the SQLite driver
 * via rows.ts — users without stored rows read pure defaults.
 */
export function createPostgresSettingsRepo(pool: Pool): SettingsRepo {
  async function readSettings(userId: string): Promise<Settings> {
    const { rows } = await pool.query('SELECT key, value FROM user_settings WHERE user_id = $1', [userId]);
    return settingsFromRows(rows);
  }

  return {
    async get(userId: string): Promise<Settings> {
      return readSettings(userId);
    },

    async update(userId: string, updates: SettingsUpdate): Promise<Settings> {
      for (const [key, value] of settingsUpdateEntries(updates)) {
        await pool.query(
          'INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value',
          [userId, key, value],
        );
      }
      return readSettings(userId);
    },
  };
}
