import type { Pool } from 'pg';
import type { PeriodRow, CreatePeriodInput } from '../../types';
import type { PeriodsRepo, PeriodUpdate } from '../types';
import { rowToPeriod } from '../rows';

/**
 * PostgreSQL periods repository — same semantics as the SQLite driver,
 * verified by the shared contract suite. half_day is a native BOOLEAN.
 * Every query is scoped to the owning user since migration 002.
 */
export function createPostgresPeriodsRepo(pool: Pool): PeriodsRepo {
  return {
    async listAll(userId: string): Promise<PeriodRow[]> {
      const { rows } = await pool.query('SELECT * FROM periods WHERE user_id = $1 ORDER BY start_date', [userId]);
      return rows.map(rowToPeriod);
    },

    async listByYear(userId: string, year: number): Promise<PeriodRow[]> {
      const { rows } = await pool.query(
        'SELECT * FROM periods WHERE user_id = $1 AND end_date >= $2 AND start_date <= $3 ORDER BY start_date',
        [userId, `${year}-01-01`, `${year}-12-31`],
      );
      return rows.map(rowToPeriod);
    },

    async create(userId: string, input: CreatePeriodInput): Promise<PeriodRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = input.type || 'urlaub';

      await pool.query(
        'INSERT INTO periods (id, user_id, start_date, end_date, note, half_day, type, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, userId, input.startDate, input.endDate, input.note || '', input.halfDay === true, type, now],
      );

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
      const { rows } = await pool.query('SELECT * FROM periods WHERE id = $1 AND user_id = $2', [id, userId]);
      const existing = rows[0] as Record<string, unknown> | undefined;
      if (!existing) return null;

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (updates.startDate !== undefined) { fields.push(`start_date = $${i++}`); values.push(updates.startDate); }
      if (updates.endDate !== undefined) { fields.push(`end_date = $${i++}`); values.push(updates.endDate); }
      if (updates.note !== undefined) { fields.push(`note = $${i++}`); values.push(updates.note); }
      if (updates.halfDay !== undefined) { fields.push(`half_day = $${i++}`); values.push(updates.halfDay === true); }
      if (updates.type !== undefined) { fields.push(`type = $${i++}`); values.push(updates.type); }

      fields.push(`changed_at = $${i++}`);
      values.push(now);
      values.push(id);
      values.push(userId);

      await pool.query(`UPDATE periods SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1}`, values);

      return rowToPeriod({
        ...existing,
        start_date: updates.startDate ?? existing.start_date,
        end_date: updates.endDate ?? existing.end_date,
        note: updates.note ?? existing.note,
        half_day: updates.halfDay !== undefined ? updates.halfDay === true : existing.half_day,
        type: updates.type ?? existing.type,
        changed_at: now,
      });
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const result = await pool.query('DELETE FROM periods WHERE id = $1 AND user_id = $2', [id, userId]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
