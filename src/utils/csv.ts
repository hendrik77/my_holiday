import type { VacationPeriod } from '../types';
import type { GermanState } from '../data/holidays';
import { countVacationWorkDays } from './calendar';

export interface CsvLabels {
  /** Semicolon-delimited header row of column names. */
  readonly header: string;
  /** Label for a half-day period. */
  readonly yes: string;
  /** Label for a full-day period. */
  readonly no: string;
}

/**
 * Canonical, locale-independent CSV labels. Used as defaults by `formatCSV`
 * (e.g. server-side export); the browser passes translated labels so the
 * downloaded file matches the UI language.
 */
export const CANONICAL_CSV_LABELS: CsvLabels = {
  header: 'Start Date;End Date;Note;Type;Half Day;Work Days',
  yes: 'Yes',
  no: 'No',
};

/** Escape a CSV field: wrap in quotes if it contains the delimiter, a quote, or a newline. */
export function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a semicolon-delimited, BOM-free CSV for the given periods.
 *
 * Pure and browser-free: callers add a BOM and trigger a download
 * (`downloadCSV`) or stream the string directly (server export). Work days are
 * computed per whole period via `countVacationWorkDays`, matching the existing
 * export contract.
 */
export function formatCSV(
  periods: VacationPeriod[],
  state: GermanState,
  labels: CsvLabels = CANONICAL_CSV_LABELS,
): string {
  const rows = [labels.header];
  for (const p of periods) {
    const workDays = countVacationWorkDays(p, state);
    const halfDayLabel = p.halfDay ? labels.yes : labels.no;
    const note = escapeCSV(p.note || '');
    const type = p.type ?? 'urlaub';
    rows.push(
      `${p.startDate};${p.endDate};${note};${type};${halfDayLabel};${workDays.toString().replace('.', ',')}`,
    );
  }
  return rows.join('\n');
}
