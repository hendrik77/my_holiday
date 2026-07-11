import type { Migration } from '../migrate';

/**
 * Baseline: the pre-v3 single-user schema, unchanged. `IF NOT EXISTS` +
 * conflict-free seeding lets existing SQLite installs adopt the migrations
 * table without touching their data.
 */

const SETTINGS_DEFAULTS: ReadonlyArray<readonly [string, string]> = [
  ['totalDays', '30'],
  ['state', 'HE'],
  ['carryOverDays', '0'],
  ['carryOverDeadline', '03-31'],
  ['carryOverMaxDays', ''],
  ['employmentStartDate', ''],
  ['employmentEndDate', ''],
  ['bildungsUrlaubDays', '0'],
];

// `ON CONFLICT DO NOTHING` is valid in both SQLite (3.24+) and PostgreSQL.
// String interpolation is safe ONLY because SETTINGS_DEFAULTS is a hardcoded
// module constant — never build migration SQL from dynamic/user input.
const seedSettings = SETTINGS_DEFAULTS.map(
  ([key, value]) => `INSERT INTO settings (key, value) VALUES ('${key}', '${value}') ON CONFLICT (key) DO NOTHING;`,
).join('\n');

const settingsTable = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const baseline: Migration = {
  id: '001-baseline',
  up: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS periods (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        half_day INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'urlaub',
        changed_at TEXT NOT NULL
      );
      ${settingsTable}
      ${seedSettings}
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS periods (
        id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        half_day BOOLEAN NOT NULL DEFAULT FALSE,
        type TEXT NOT NULL DEFAULT 'urlaub',
        changed_at TEXT NOT NULL
      );
      ${settingsTable}
      ${seedSettings}
    `,
  },
};
