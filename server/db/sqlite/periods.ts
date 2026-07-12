import type Database from 'better-sqlite3';
import type { PeriodRow, CreatePeriodInput } from '../../types';
import type { PeriodsRepo, PeriodUpdate } from '../types';
import { rowToPeriod } from '../rows';

/**
 * SQLite periods repository. SQL bodies moved unchanged from the pre-v3
 * `server/db.ts`; every query is scoped to the owning user since
 * migration 002.
 */
export function createSqlitePeriodsRepo(db: Database.Database): PeriodsRepo {
  return {
    async listAll(userId: string): Promise<PeriodRow[]> {
      const rows = db
        .prepare('SELECT * FROM periods WHERE user_id = ? ORDER BY start_date')
        .all(userId) as Record<string, unknown>[];
      return rows.map(rowToPeriod);
    },

    async listByYear(userId: string, year: number): Promise<PeriodRow[]> {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const rows = db
        .prepare('SELECT * FROM periods WHERE user_id = ? AND end_date >= ? AND start_date <= ? ORDER BY start_date')
        .all(userId, yearStart, yearEnd) as Record<string, unknown>[];
      return rows.map(rowToPeriod);
    },

    async create(userId: string, input: CreatePeriodInput): Promise<PeriodRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = input.type || 'urlaub';

      db.prepare(
        'INSERT INTO periods (id, user_id, start_date, end_date, note, half_day, type, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(id, userId, input.startDate, input.endDate, input.note || '', input.halfDay ? 1 : 0, type, now);

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

    async update(userId: string, id: string, updates: PeriodUpdate): Promise<PeriodRow | null> {
      const existing = db.prepare('SELECT * FROM periods WHERE id = ? AND user_id = ?').get(id, userId) as
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
      values.push(userId);

      db.prepare(`UPDATE periods SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

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

    async remove(userId: string, id: string): Promise<boolean> {
      const result = db.prepare('DELETE FROM periods WHERE id = ? AND user_id = ?').run(id, userId);
      return result.changes > 0;
    },
  };
}
