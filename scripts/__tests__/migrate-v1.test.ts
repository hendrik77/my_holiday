import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { initDb, getPeriodsByYear } from '../../server/db';

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

  function openDb(): Database.Database {
    const db = new Database(TEST_DB);
    initDb(db);
    return db;
  }

  it('imports periods from a valid CSV', () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
      '2026-12-23;2026-12-23;Weihnachten;Ja;0,5',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 2');

    const db = openDb();
    const periods = getPeriodsByYear(db, 2026);
    expect(periods).toHaveLength(2);
    expect(periods[0].startDate).toBe('2026-07-01');
    expect(periods[0].note).toBe('Sommerurlaub');
    expect(periods[1].halfDay).toBe(true);
    db.close();
  });

  it('is idempotent — re-running skips existing periods', () => {
    const csv = [
      'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage',
      '2026-07-01;2026-07-15;Sommerurlaub;Nein;11',
    ].join('\n');

    runMigrate(csv);

    const output2 = runMigrate(csv);
    expect(output2).toContain('Skipped 1');

    const db = openDb();
    const periods = getPeriodsByYear(db, 2026);
    expect(periods).toHaveLength(1);
    db.close();
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

  it('accepts English column headers', () => {
    const csv = [
      'Start Date;End Date;Note;Half Day;Work Days',
      '2026-08-01;2026-08-15;Summer;No;11',
    ].join('\n');

    const output = runMigrate(csv);
    expect(output).toContain('Imported 1');

    const db = openDb();
    const periods = getPeriodsByYear(db, 2026);
    expect(periods).toHaveLength(1);
    expect(periods[0].startDate).toBe('2026-08-01');
    db.close();
  });

  it('preserves existing periods when running migration', () => {
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

    const db = openDb();
    const periods = getPeriodsByYear(db, 2026);
    expect(periods).toHaveLength(2);
    db.close();
  });
});
