import type Database from 'better-sqlite3';
import type { PrivacyLevel } from '../../types';
import type { OrgSettingsRepo } from '../types';

/** SQLite org-settings repository (migration 005). */
export function createSqliteOrgSettingsRepo(db: Database.Database): OrgSettingsRepo {
  return {
    async getPrivacyLevel(): Promise<PrivacyLevel> {
      const row = db.prepare("SELECT value FROM org_settings WHERE key = 'privacyLevel'").get() as
        | { value: string }
        | undefined;
      return (row?.value as PrivacyLevel) ?? 'dates';
    },

    async setPrivacyLevel(level: PrivacyLevel): Promise<void> {
      db.prepare("INSERT OR REPLACE INTO org_settings (key, value) VALUES ('privacyLevel', ?)").run(level);
    },
  };
}
