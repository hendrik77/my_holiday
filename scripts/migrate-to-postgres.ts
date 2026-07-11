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

async function main() {
  const sqlitePath = arg('--sqlite');
  const databaseUrl = arg('--database-url') || process.env.DATABASE_URL;

  if (!sqlitePath || !databaseUrl) {
    console.error('Usage: npx tsx scripts/migrate-to-postgres.ts --sqlite <path> --database-url <url>');
    process.exit(1);
  }
  if (!existsSync(sqlitePath)) {
    console.error(`Error: SQLite file not found: "${sqlitePath}"`);
    process.exit(1);
  }

  // Source: read-only snapshot of the raw rows.
  const src = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const periods = src.prepare('SELECT * FROM periods').all() as Record<string, unknown>[];
  const settings = src.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  src.close();

  // Target: bring the schema up to date, then refuse if periods exist.
  const target = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: databaseUrl }));
  const existing = await target.periods.listAll(DEFAULT_USER_ID);
  await target.close();
  if (existing.length > 0) {
    console.error(
      `Error: target database is not empty (${existing.length} period(s)) — refusing to migrate into existing data`,
    );
    process.exit(1);
  }

  // Copy raw rows in one transaction, preserving ids and timestamps.
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of periods) {
        await client.query(
          'INSERT INTO periods (id, start_date, end_date, note, half_day, type, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [row.id, row.start_date, row.end_date, row.note, row.half_day === 1, row.type, row.changed_at],
        );
      }
      for (const { key, value } of settings) {
        await client.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM periods');
    if (rows[0].n !== periods.length) {
      console.error(`Error: verification failed — expected ${periods.length} period(s), found ${rows[0].n}`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }

  console.log(`✅ Migrated ${periods.length} period(s) and ${settings.length} setting(s) to PostgreSQL.`);
  console.log('   Point the server at it with DB_DRIVER=postgres and DATABASE_URL, then verify before deleting the SQLite file.');
}

await main();
