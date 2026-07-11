/**
 * One-shot data migration: copy a single-user SQLite database into an
 * empty PostgreSQL database (ADR-0006 upgrade path to multi-user mode).
 *
 * Usage: npx tsx scripts/migrate-to-postgres.ts --sqlite <path> [--database-url <url>]
 *        (npm run migrate:postgres -- --sqlite data/my-holiday.db)
 *
 * DATABASE_URL from the environment is used when --database-url is omitted.
 * The SQLite source is opened read-only and never modified. The target must
 * contain no periods — this tool refuses to merge into existing data.
 * Row ids and changed_at timestamps are preserved.
 */
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { existsSync } from 'node:fs';
import { createDb, DEFAULT_USER_ID } from '../server/db';
import { loadConfig } from '../server/config';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

/** Operator-facing failure: printed as-is, exit code 1, no stack trace. */
class MigrationError extends Error {}

async function countRows(
  client: { query: (sql: string) => Promise<{ rows: { n: number }[] }> },
  table: 'periods' | 'user_settings',
): Promise<number> {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function main() {
  const sqlitePath = arg('--sqlite');
  const databaseUrl = arg('--database-url') || process.env.DATABASE_URL;

  if (!sqlitePath || !databaseUrl) {
    throw new MigrationError('Usage: npx tsx scripts/migrate-to-postgres.ts --sqlite <path> --database-url <url>');
  }
  if (arg('--database-url')) {
    console.error('Warning: --database-url is visible in shell history and process lists — prefer the DATABASE_URL env var.');
  }
  if (!existsSync(sqlitePath)) {
    throw new MigrationError(`Error: SQLite file not found: "${sqlitePath}"`);
  }

  // Source: read-only snapshot of the raw rows. Supports both pre-v3 files
  // (singleton `settings`, no user_id — everything belongs to the default
  // user) and v3 files (users / user_settings / periods.user_id).
  const src = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const srcTables = new Set(
    (src.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    ),
  );
  const periods = src.prepare('SELECT * FROM periods').all() as Record<string, unknown>[];
  const users = srcTables.has('users')
    ? (src.prepare('SELECT * FROM users').all() as Record<string, unknown>[])
    : [];
  const settings = srcTables.has('user_settings')
    ? (src.prepare('SELECT user_id, key, value FROM user_settings').all() as {
        user_id: string;
        key: string;
        value: string;
      }[])
    : (src.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map((row) => ({
        user_id: DEFAULT_USER_ID,
        ...row,
      }));
  src.close();

  // Target: bring the schema up to date before touching it directly.
  const target = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: databaseUrl }));
  await target.close();

  // Emptiness guard, copy, and verification all run in ONE transaction on
  // ONE client with the tables locked — nothing can slip rows in between the
  // "target is empty" observation and the commit, and any failure rolls back.
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE periods, user_settings, users IN EXCLUSIVE MODE');

      const existing = await countRows(client, 'periods');
      if (existing > 0) {
        throw new MigrationError(
          `Error: target database is not empty (${existing} period(s)) — refusing to migrate into existing data`,
        );
      }

      // Users first (periods.user_id references them). The default user
      // already exists on the target — migration 002 inserts it.
      for (const row of users) {
        await client.query(
          `INSERT INTO users (id, oidc_sub, email, name, team, role, manager_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [row.id, row.oidc_sub, row.email, row.name, row.team, row.role, row.manager_id, row.created_at, row.updated_at],
        );
      }
      for (const row of periods) {
        await client.query(
          'INSERT INTO periods (id, user_id, start_date, end_date, note, half_day, type, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [row.id, row.user_id ?? DEFAULT_USER_ID, row.start_date, row.end_date, row.note, row.half_day === 1, row.type, row.changed_at],
        );
      }
      // Source values win over the seed rows migration 002 created on the target.
      for (const { user_id, key, value } of settings) {
        await client.query(
          'INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value',
          [user_id, key, value],
        );
      }

      const periodCount = await countRows(client, 'periods');
      const settingsCount = await countRows(client, 'user_settings');
      if (periodCount !== periods.length || settingsCount < settings.length) {
        throw new MigrationError(
          `Error: verification failed — expected ${periods.length} period(s) and ${settings.length} setting(s), ` +
            `found ${periodCount} and ${settingsCount}; nothing was written`,
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }

  console.log(`✅ Migrated ${periods.length} period(s) and ${settings.length} setting(s) to PostgreSQL.`);
  console.log('   Point the server at it with DB_DRIVER=postgres and DATABASE_URL, then verify before deleting the SQLite file.');
}

try {
  await main();
} catch (error) {
  if (error instanceof MigrationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
