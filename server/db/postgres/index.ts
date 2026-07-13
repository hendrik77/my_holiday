import { Pool } from 'pg';
import type { Config } from '../../config';
import type { Db } from '../types';
import { SCHEMA_MIGRATIONS_TABLE_SQL, pendingMigrations } from '../migrate';
import { migrations } from '../migrations';
import { createPostgresPeriodsRepo } from './periods';
import { createPostgresSettingsRepo } from './settings';
import { createPostgresUsersRepo } from './users';
import { createPostgresRefreshTokensRepo } from './refresh-tokens';
import { createPostgresPatsRepo } from './pats';

/** Arbitrary app-wide lock id so concurrent instances serialize migrations. */
const MIGRATION_LOCK_ID = 727274;

/** Apply pending migrations inside one transaction, serialized via advisory lock. */
async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(SCHEMA_MIGRATIONS_TABLE_SQL);

    const { rows } = await client.query('SELECT id FROM schema_migrations');
    const applied = new Set<string>(rows.map((r: { id: string }) => r.id));

    for (const migration of pendingMigrations(migrations, applied)) {
      await client.query(migration.up.postgres);
      await client.query('INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)', [
        migration.id,
        new Date().toISOString(),
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** PostgreSQL backend — required for multi-user mode (ADR-0006). */
export function createPostgresDb(config: Pick<Config, 'DATABASE_URL'>): Db {
  const pool = new Pool({ connectionString: config.DATABASE_URL });

  return {
    driver: 'postgres',
    periods: createPostgresPeriodsRepo(pool),
    settings: createPostgresSettingsRepo(pool),
    users: createPostgresUsersRepo(pool),
    refreshTokens: createPostgresRefreshTokensRepo(pool),
    pats: createPostgresPatsRepo(pool),
    async migrate(): Promise<void> {
      await runMigrations(pool);
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
