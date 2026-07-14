import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Config } from '../../config';
import type { Db } from '../types';
import { SCHEMA_MIGRATIONS_TABLE_SQL, pendingMigrations } from '../migrate';
import { migrations } from '../migrations';
import { createSqlitePeriodsRepo } from './periods';
import { createSqliteSettingsRepo } from './settings';
import { createSqliteUsersRepo } from './users';
import { createSqliteRefreshTokensRepo } from './refresh-tokens';
import { createSqlitePatsRepo } from './pats';
import { createSqliteOrgSettingsRepo } from './org-settings';

/**
 * Apply pending migrations, each inside a transaction. Foreign-key
 * enforcement is suspended while migrating — SQLite forbids ALTER TABLE ADD
 * COLUMN with a REFERENCES clause and a non-NULL default when it is on
 * (migration 002 adds periods.user_id exactly that way) — and restored
 * afterwards so normal operation enforces referential integrity like
 * PostgreSQL does.
 */
function runMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = OFF');
  try {
    db.exec(SCHEMA_MIGRATIONS_TABLE_SQL);
    const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[];
    const applied = new Set(appliedRows.map((r) => r.id));

    for (const migration of pendingMigrations(migrations, applied)) {
      const apply = db.transaction(() => {
        db.exec(migration.up.sqlite);
        db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
          migration.id,
          new Date().toISOString(),
        );
      });
      apply();
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/** SQLite backend — the single-user default (ADR-0006). */
export function createSqliteDb(config: Pick<Config, 'DB_PATH'>): Db {
  if (config.DB_PATH !== ':memory:') {
    mkdirSync(dirname(config.DB_PATH), { recursive: true });
  }
  const db = new Database(config.DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    driver: 'sqlite',
    periods: createSqlitePeriodsRepo(db),
    settings: createSqliteSettingsRepo(db),
    users: createSqliteUsersRepo(db),
    refreshTokens: createSqliteRefreshTokensRepo(db),
    pats: createSqlitePatsRepo(db),
    orgSettings: createSqliteOrgSettingsRepo(db),
    async migrate(): Promise<void> {
      runMigrations(db);
    },
    async close(): Promise<void> {
      db.close();
    },
  };
}
