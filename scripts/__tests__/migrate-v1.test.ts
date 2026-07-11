import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, DEFAULT_USER_ID, type Db } from '../../server/db';
import { loadConfig } from '../../server/config';

const TEST_CSV = join(tmpdir(), 'test-urlaub-migrate.csv');
const TEST_DB = join(tmpdir(), 'test-my-holiday.db');

function writeTestCsv(content: string) {
  writeFileSync(TEST_CSV, content, 'utf-8');
}

function cleanup() {
  if (existsSync(TEST_CSV)) unlinkSync(TEST_CSV);
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
}

describe('migrate-v1 script', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  function runMigrate(csvContent: string): string {
    writeTestCsv(csvContent);
    try {
      return execSync(
        `npx tsx scripts/migrate-v1.ts "${TEST_CSV}" --db "${TEST_DB}" 2>&1`,
        { encoding: 'utf-8' }
      );
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; status?: number };
      return (err.stdout || '') + (err.stderr || '');
    }
  }

  function openDb(): Promise<Db> {
    return createDb(loadConfig({ DB_PATH: TEST_DB }));
  }

  it('imports periods from a valid CSV', async () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
      '2026-12-23;2026-12-23;Weihnachten;Ja;0,5',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 2');

    const db = await openDb();
    const periods = await db.periods.listByYear(DEFAULT_USER_ID, 2026);
    expect(periods).toHaveLength(2);
    expect(periods[0].startDate).toBe('2026-07-01');
    expect(periods[0].note).toBe('Sommerurlaub');
    expect(periods[1].halfDay).toBe(true);
    await db.close();
  });

  it('skips duplicate rows within a single CSV', async () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 1');
    expect(output).toContain('Skipped 1');

    const db = await openDb();
    const periods = await db.periods.listByYear(DEFAULT_USER_ID, 2026);
    expect(periods).toHaveLength(1);
    await db.close();
  });

  it('is idempotent — re-running skips existing periods', async () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
    ].join('\n');

    runMigrate(csv);

    const output2 = runMigrate(csv);
    expect(output2).toContain('Skipped 1');

    const db = await openDb();
    const periods = await db.periods.listByYear(DEFAULT_USER_ID, 2026);
    expect(periods).toHaveLength(1);
    await db.close();
  });

  it('handles empty CSV (header only)', () => {
    const csv = 'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage\n';
    const output = runMigrate(csv);
    expect(output).toContain('No entries');
  });

  it('handles completely empty file', () => {
    writeTestCsv('');
    const output = runMigrate('');
    expect(output).toContain('No entries');
  });

  it('handles missing header', () => {
    const csv = '2026-07-01;2026-07-15;Test;Nein;11';
    const output = runMigrate(csv);
    expect(output).toContain('No header');
  });

  it('handles corrupt dates with warnings', () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Gültig;Nein;11',
      'bad-date;2026-08-01;Kaputt;Nein;1',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 1');
    expect(output.toLowerCase()).toMatch(/invalid|ungültig/);
  });

  it('accepts English column headers', async () => {
    const csv = [
      'Start Date;End Date;Note;Half Day;Work Days',
      '2026-08-01;2026-08-15;Summer;No;11',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 1');

    const db = await openDb();
    const periods = await db.periods.listByYear(DEFAULT_USER_ID, 2026);
    expect(periods).toHaveLength(1);
    expect(periods[0].startDate).toBe('2026-08-01');
    await db.close();
  });

  it('preserves existing periods when running migration', async () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Neu;Nein;11',
    ].join('\n');

    // First run creates the period
    const output1 = runMigrate(csv);
    expect(output1).toContain('Imported 1');

    // Second CSV with a different period
    const csv2 = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-08-01;2026-08-05;August;Nein;5',
    ].join('\n');
    const output2 = runMigrate(csv2);
    expect(output2).toContain('Imported 1');

    const db = await openDb();
    const periods = await db.periods.listByYear(DEFAULT_USER_ID, 2026);
    expect(periods).toHaveLength(2);
    await db.close();
  });
});
