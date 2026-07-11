import type { Pool } from 'pg';
import type { PeriodRow, CreatePeriodInput } from '../../types';
import type { PeriodsRepo, PeriodUpdate } from '../types';
import { rowToPeriod } from '../rows';

/**
 * PostgreSQL periods repository — same semantics as the SQLite driver,
 * verified by the shared contract suite. half_day is a native BOOLEAN.
 * userId is accepted per the contract; scoping lands with migration 002.
 */
export function createPostgresPeriodsRepo(pool: Pool): PeriodsRepo {
  return {
    async listAll(): Promise<PeriodRow[]> {
      const { rows } = await pool.query('SELECT * FROM periods ORDER BY start_date');
      return rows.map(rowToPeriod);
    },

    async listByYear(_userId: string, year: number): Promise<PeriodRow[]> {
      const { rows } = await pool.query(
        'SELECT * FROM periods WHERE end_date >= $1 AND start_date <= $2 ORDER BY start_date',
        [`${year}-01-01`, `${year}-12-31`],
      );
      return rows.map(rowToPeriod);
    },

    async create(_userId: string, input: CreatePeriodInput): Promise<PeriodRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = input.type || 'urlaub';

      await pool.query(
        'INSERT INTO periods (id, start_date, end_date, note, half_day, type, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, input.startDate, input.endDate, input.note || '', input.halfDay === true, type, now],
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

    async update(_userId: string, id: string, updates: PeriodUpdate): Promise<PeriodRow | null> {
      const { rows } = await pool.query('SELECT * FROM periods WHERE id = $1', [id]);
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

      await pool.query(`UPDATE periods SET ${fields.join(', ')} WHERE id = $${i}`, values);

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

    async remove(_userId: string, id: string): Promise<boolean> {
      const result = await pool.query('DELETE FROM periods WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
