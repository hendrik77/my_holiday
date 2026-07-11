import type Database from 'better-sqlite3';
import type { PeriodRow, CreatePeriodInput } from '../../types';
import type { PeriodsRepo, PeriodUpdate } from '../types';
import { rowToPeriod } from '../rows';

/**
 * SQLite periods repository. SQL bodies moved unchanged from the pre-v3
 * `server/db.ts`. The userId parameter is accepted per the repo contract but
 * not yet used — the baseline schema is single-user until migration 002.
 */
export function createSqlitePeriodsRepo(db: Database.Database): PeriodsRepo {
  return {
    // Contract passes userId; omitted here until the schema is user-scoped.
    async listAll(): Promise<PeriodRow[]> {
      const rows = db.prepare('SELECT * FROM periods ORDER BY start_date').all() as Record<string, unknown>[];
      return rows.map(rowToPeriod);
    },

    async listByYear(_userId: string, year: number): Promise<PeriodRow[]> {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const rows = db
        .prepare('SELECT * FROM periods WHERE end_date >= ? AND start_date <= ? ORDER BY start_date')
        .all(yearStart, yearEnd) as Record<string, unknown>[];
      return rows.map(rowToPeriod);
    },

    async create(_userId: string, input: CreatePeriodInput): Promise<PeriodRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = input.type || 'urlaub';

      db.prepare(
        'INSERT INTO periods (id, start_date, end_date, note, half_day, type, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
    },

    async update(_userId: string, id: string, updates: PeriodUpdate): Promise<PeriodRow | null> {
      const existing = db.prepare('SELECT * FROM periods WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
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
    },

    async remove(_userId: string, id: string): Promise<boolean> {
      const result = db.prepare('DELETE FROM periods WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}
