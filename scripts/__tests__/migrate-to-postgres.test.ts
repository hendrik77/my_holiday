import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createDb, DEFAULT_USER_ID } from '../../server/db';
import { loadConfig } from '../../server/config';

const url = process.env.TEST_DATABASE_URL;
const FIXTURE_DB = join(tmpdir(), 'migrate-to-pg-fixture.db');

/**
 * SQLite → PostgreSQL data migration (ADR-0006 upgrade path). Needs a
 * Postgres at TEST_DATABASE_URL — CI service container; skipped locally
 * without one, like the pg contract leg.
 */
function cleanupFixture() {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = FIXTURE_DB + suffix;
    if (existsSync(f)) unlinkSync(f);
  }
}

function runScript(args: string): { output: string; status: number } {
  try {
    const output = execSync(`npx tsx scripts/migrate-to-postgres.ts ${args} 2>&1`, { encoding: 'utf-8' });
    return { output, status: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { output: (err.stdout || '') + (err.stderr || ''), status: err.status ?? 1 };
  }
}

describe.skipIf(!url)('migrate-to-postgres script', () => {
  beforeEach(async () => {
    cleanupFixture();
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(
      'DROP TABLE IF EXISTS periods, settings, user_settings, refresh_tokens, pats, users, schema_migrations CASCADE',
    );
    await admin.end();

    // Fixture: a populated single-user SQLite database.
    const sqlite = await createDb(loadConfig({ DB_PATH: FIXTURE_DB }));
    await sqlite.periods.create(DEFAULT_USER_ID, {
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      note: 'Sommerurlaub',
      halfDay: false,
      type: 'urlaub',
    });
    await sqlite.periods.create(DEFAULT_USER_ID, {
      startDate: '2026-12-24',
      endDate: '2026-12-24',
      note: 'Heiligabend',
      halfDay: true,
      type: 'sonderurlaub',
    });
    await sqlite.settings.update(DEFAULT_USER_ID, { totalDays: 28, state: 'BY' });
    await sqlite.close();
  });

  afterEach(() => {
    cleanupFixture();
  });

  it('copies periods and settings into an empty Postgres and verifies counts', async () => {
    const { output, status } = runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);
    expect(status).toBe(0);
    expect(output).toContain('2 period(s)');

    const pgDb = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: url }));
    const periods = await pgDb.periods.listAll(DEFAULT_USER_ID);
    expect(periods).toHaveLength(2);

    const summer = periods.find((p) => p.note === 'Sommerurlaub');
    expect(summer).toBeDefined();
    expect(summer!.startDate).toBe('2026-07-01');
    expect(summer!.halfDay).toBe(false);

    const xmas = periods.find((p) => p.note === 'Heiligabend');
    expect(xmas!.halfDay).toBe(true);
    expect(xmas!.type).toBe('sonderurlaub');

    const settings = await pgDb.settings.get(DEFAULT_USER_ID);
    expect(settings.totalDays).toBe(28);
    expect(settings.state).toBe('BY');
    await pgDb.close();
  });

  it('preserves period ids and changedAt timestamps', async () => {
    const src = await createDb(loadConfig({ DB_PATH: FIXTURE_DB }));
    const [original] = await src.periods.listAll(DEFAULT_USER_ID);
    await src.close();

    runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);

    const pgDb = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: url }));
    const migrated = (await pgDb.periods.listAll(DEFAULT_USER_ID)).find((p) => p.id === original.id);
    expect(migrated).toBeDefined();
    expect(migrated!.changedAt).toBe(original.changedAt);
    await pgDb.close();
  });

  it('preserves manager relations even when a report was created before their manager', async () => {
    const src = await createDb(loadConfig({ DB_PATH: FIXTURE_DB }));
    // Report first: rowid order would insert them before the manager row.
    const report = await src.users.upsertFromIdP({ oidcSub: 'idp|report', email: 'report@example.com', name: 'R' });
    const manager = await src.users.upsertFromIdP({ oidcSub: 'idp|manager', email: 'manager@example.com', name: 'M' });
    await src.users.updateProfile(manager.id, { role: 'manager' });
    await src.users.updateProfile(report.id, { managerId: manager.id });
    await src.close();

    const { output, status } = runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);
    expect(status, output).toBe(0);

    const pgDb = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: url }));
    const reports = await pgDb.users.listDirectReports(manager.id);
    expect(reports.map((u) => u.email)).toEqual(['report@example.com']);
    await pgDb.close();
  });

  it('refuses to run against a Postgres that already has registered users', async () => {
    const pgDb = await createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: url! }));
    await pgDb.users.upsertFromIdP({ oidcSub: 'idp|existing', email: 'existing@example.com', name: 'E' });
    await pgDb.close();

    const { output, status } = runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);
    expect(status).not.toBe(0);
    expect(output.toLowerCase()).toContain('not empty');
  });

  it('refuses to run against a Postgres that already has periods', async () => {
    const first = runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);
    expect(first.status).toBe(0);

    const second = runScript(`--sqlite "${FIXTURE_DB}" --database-url "${url}"`);
    expect(second.status).not.toBe(0);
    expect(second.output.toLowerCase()).toContain('not empty');
  });

  it('fails with a clear error for a missing SQLite file', () => {
    const { output, status } = runScript(`--sqlite "/nonexistent/nope.db" --database-url "${url}"`);
    expect(status).not.toBe(0);
    expect(output.toLowerCase()).toMatch(/cannot|not found|no such/);
  });
});
