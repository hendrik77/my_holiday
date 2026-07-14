import type { Pool } from 'pg';
import type { PrivacyLevel } from '../../types';
import type { OrgSettingsRepo } from '../types';

/** PostgreSQL org-settings repository — same semantics as the SQLite driver, verified by the shared contract suite. */
export function createPostgresOrgSettingsRepo(pool: Pool): OrgSettingsRepo {
  return {
    async getPrivacyLevel(): Promise<PrivacyLevel> {
      const { rows } = await pool.query("SELECT value FROM org_settings WHERE key = 'privacyLevel'");
      return (rows[0]?.value as PrivacyLevel) ?? 'dates';
    },

    async setPrivacyLevel(level: PrivacyLevel): Promise<void> {
      await pool.query(
        "INSERT INTO org_settings (key, value) VALUES ('privacyLevel', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [level],
      );
    },
  };
}
