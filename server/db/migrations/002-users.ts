import type { Migration } from '../migrate';
import { DEFAULT_USER_ID } from '../constants';

/**
 * Multi-user schema (Phase 3, ADR-0006):
 *
 * - `users` table; the synthetic default user is inserted here so existing
 *   single-user installs keep working unchanged (AUTH_MODE=none maps every
 *   request to it).
 * - `periods.user_id` — existing rows are assigned to the default user via
 *   the column default; SQLite keeps that default (cannot drop it without a
 *   table rebuild), PostgreSQL drops it so inserts must be explicit.
 * - `settings` → `user_settings(user_id, key, value)`; existing rows are
 *   copied to the default user, then the old table is dropped (breaking
 *   change for external tooling reading the file directly — CHANGELOG).
 *
 * String interpolation is safe ONLY because DEFAULT_USER_ID is a hardcoded
 * module constant — never build migration SQL from dynamic/user input.
 */

const usersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    oidc_sub TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    team TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
    manager_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

const userSettingsTable = `
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT NOT NULL REFERENCES users(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
`;

function defaultUserInsert(nowExpr: string): string {
  return `
    INSERT INTO users (id, oidc_sub, email, name, team, role, manager_id, created_at, updated_at)
    VALUES ('${DEFAULT_USER_ID}', NULL, 'local@my-holiday.invalid', 'Local user', '', 'admin', NULL, ${nowExpr}, ${nowExpr})
    ON CONFLICT (id) DO NOTHING;
  `;
}

// "WHERE true" disambiguates the upsert clause: without it SQLite parses the
// ON as a JOIN constraint of the FROM clause ("near DO: syntax error").
const copySettings = `
  INSERT INTO user_settings (user_id, key, value)
    SELECT '${DEFAULT_USER_ID}', key, value FROM settings WHERE true
    ON CONFLICT (user_id, key) DO NOTHING;
  DROP TABLE settings;
`;

const periodsIndex = 'CREATE INDEX IF NOT EXISTS idx_periods_user_start ON periods (user_id, start_date);';

export const users: Migration = {
  id: '002-users',
  up: {
    sqlite: `
      ${usersTable}
      ${defaultUserInsert("strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")}
      ALTER TABLE periods ADD COLUMN user_id TEXT NOT NULL DEFAULT '${DEFAULT_USER_ID}' REFERENCES users(id);
      ${periodsIndex}
      ${userSettingsTable}
      ${copySettings}
    `,
    postgres: `
      ${usersTable}
      ${defaultUserInsert("to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")}
      ALTER TABLE periods ADD COLUMN user_id TEXT NOT NULL DEFAULT '${DEFAULT_USER_ID}' REFERENCES users(id);
      ALTER TABLE periods ALTER COLUMN user_id DROP DEFAULT;
      ${periodsIndex}
      ${userSettingsTable}
      ${copySettings}
    `,
  },
};
