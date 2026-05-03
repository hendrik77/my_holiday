import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PeriodRow, CreatePeriodInput, Settings, SettingsUpdate } from './types';

/** Initialize the database schema */
export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS periods (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      half_day INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'urlaub',
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Insert default settings if they don't exist
  const defaults: Record<string, string> = {
    totalDays: '30',
    state: 'HE',
    carryOverDays: '0',
    carryOverDeadline: '03-31',
    carryOverMaxDays: '',
    employmentStartDate: '',
    employmentEndDate: '',
    bildungsUrlaubDays: '0',
  };

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }
}

/** Create a production database instance (SQLite file) */
export function createDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initDb(db);
  return db;
}

function rowToPeriod(row: Record<string, unknown>): PeriodRow {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    note: row.note as string,
    halfDay: (row.half_day as number) === 1,
    type: ((row.type as string) || 'urlaub') as PeriodRow['type'],
    changedAt: row.changed_at as string,
  };
}

/** Get all periods */
export function getAllPeriods(db: Database.Database): PeriodRow[] {
  const rows = db.prepare('SELECT * FROM periods ORDER BY start_date').all() as Record<string, unknown>[];
  return rows.map(rowToPeriod);
}

/** Get periods that overlap with a given year */
export function getPeriodsByYear(db: Database.Database, year: number): PeriodRow[] {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const rows = db
    .prepare(
      'SELECT * FROM periods WHERE end_date >= ? AND start_date <= ? ORDER BY start_date'
    )
    .all(yearStart, yearEnd) as Record<string, unknown>[];
  return rows.map(rowToPeriod);
}

/** Create a new period */
export function createPeriod(db: Database.Database, input: CreatePeriodInput): PeriodRow {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const type = input.type || 'urlaub';

  db.prepare(
    'INSERT INTO periods (id, start_date, end_date, note, half_day, type, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.startDate, input.endDate, input.note || '', input.halfDay ? 1 : 0, type, now);

  return {
    id,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note || '',
    halfDay: input.halfDay || false,
    type,
    changedAt: now,
  };
}

/** Update an existing period. Returns updated period or null if not found. */
export function updatePeriod(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<PeriodRow, 'startDate' | 'endDate' | 'note' | 'halfDay' | 'type'>>
): PeriodRow | null {
  const existing = db.prepare('SELECT * FROM periods WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.startDate !== undefined) { fields.push('start_date = ?'); values.push(updates.startDate); }
  if (updates.endDate !== undefined) { fields.push('end_date = ?'); values.push(updates.endDate); }
  if (updates.note !== undefined) { fields.push('note = ?'); values.push(updates.note); }
  if (updates.halfDay !== undefined) { fields.push('half_day = ?'); values.push(updates.halfDay ? 1 : 0); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }

  fields.push('changed_at = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE periods SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return rowToPeriod({
    ...existing,
    start_date: updates.startDate ?? existing.start_date,
    end_date: updates.endDate ?? existing.end_date,
    note: updates.note ?? existing.note,
    half_day: updates.halfDay !== undefined ? (updates.halfDay ? 1 : 0) : existing.half_day,
    type: updates.type ?? existing.type,
    changed_at: now,
  });
}

/** Delete a period by id. Returns true if deleted, false if not found. */
export function deletePeriod(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM periods WHERE id = ?').run(id);
  return result.changes > 0;
}

/** Get all settings as a typed object */
export function getSettings(db: Database.Database): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    totalDays: parseInt(map.get('totalDays') || '30', 10),
    state: map.get('state') || 'HE',
    carryOverDays: parseInt(map.get('carryOverDays') || '0', 10),
    carryOverDeadline: map.get('carryOverDeadline') || '03-31',
    carryOverMaxDays: map.get('carryOverMaxDays') ? parseInt(map.get('carryOverMaxDays')!, 10) : null,
    employmentStartDate: map.get('employmentStartDate') || '',
    employmentEndDate: map.get('employmentEndDate') || '',
    bildungsUrlaubDays: parseInt(map.get('bildungsUrlaubDays') || '0', 10),
  };
}

/** Update settings. Only the provided keys are changed. */
export function updateSettings(db: Database.Database, updates: SettingsUpdate): Settings {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  if (updates.totalDays !== undefined) upsert.run('totalDays', String(updates.totalDays));
  if (updates.state !== undefined) upsert.run('state', updates.state);
  if (updates.carryOverDays !== undefined) upsert.run('carryOverDays', String(updates.carryOverDays));
  if (updates.carryOverDeadline !== undefined) upsert.run('carryOverDeadline', updates.carryOverDeadline);
  if (updates.carryOverMaxDays !== undefined) upsert.run('carryOverMaxDays', updates.carryOverMaxDays === null ? '' : String(updates.carryOverMaxDays));
  if (updates.employmentStartDate !== undefined) upsert.run('employmentStartDate', updates.employmentStartDate);
  if (updates.employmentEndDate !== undefined) upsert.run('employmentEndDate', updates.employmentEndDate);
  if (updates.bildungsUrlaubDays !== undefined) upsert.run('bildungsUrlaubDays', String(updates.bildungsUrlaubDays));

  return getSettings(db);
}
