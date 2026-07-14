import type { Migration } from '../migrate';

/**
 * Org-wide settings (Phase 7): a shared key-value row set, admin-managed.
 * privacyLevel governs what team views reveal (nothing | dates |
 * dates_notes); managers always see their reports' dates. Identical SQL
 * for both dialects.
 */
const orgSettings = `
  CREATE TABLE IF NOT EXISTS org_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT INTO org_settings (key, value) VALUES ('privacyLevel', 'dates') ON CONFLICT (key) DO NOTHING;
`;

export const org: Migration = {
  id: '005-org',
  up: {
    sqlite: orgSettings,
    postgres: orgSettings,
  },
};
