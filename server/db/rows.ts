import type { PeriodRow } from '../types';

/**
 * Map a raw `periods` row to the API shape. Shared by both drivers:
 * SQLite stores half_day as INTEGER 0/1, PostgreSQL as BOOLEAN.
 */
export function rowToPeriod(row: Record<string, unknown>): PeriodRow {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    note: row.note as string,
    halfDay: row.half_day === 1 || row.half_day === true,
    type: ((row.type as string) || 'urlaub') as PeriodRow['type'],
    changedAt: row.changed_at as string,
  };
}
