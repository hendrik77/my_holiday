import { type VacationPeriod, type VacationType, VACATION_TYPES } from '../types';
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

/** Leading characters that make a spreadsheet execute a cell as a formula (OWASP CSV injection). */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/** Prefix a guard apostrophe so spreadsheets display, not execute, the value. */
function guardFormula(value: string): string {
  return value !== '' && FORMULA_TRIGGERS.includes(value[0]) ? `'${value}` : value;
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
    const note = escapeCSV(guardFormula(p.note || ''));
    const type = p.type ?? 'urlaub';
    rows.push(
      `${p.startDate};${p.endDate};${note};${type};${halfDayLabel};${workDays.toString().replace('.', ',')}`,
    );
  }
  return rows.join('\n');
}

/** Message lookup used by `parseImportCSV` (the browser passes an i18n `t`). */
export type ImportMessage = (key: string, params?: Record<string, string | number>) => string;

/** Canonical, locale-independent import messages (server/CLI default). */
const defaultImportMessage: ImportMessage = (key, params) => {
  switch (key) {
    case 'csv.emptyFile': return 'The CSV file is empty.';
    case 'csv.missingHeader': return 'No recognizable header row found.';
    case 'csv.missingColumns': return 'Required start/end date columns are missing.';
    case 'csv.invalidDate': return `Row ${params?.row}: invalid start date "${params?.value}".`;
    case 'csv.invalidEndDate': return `Row ${params?.row}: invalid end date "${params?.value}".`;
    case 'csv.noEntries': return 'No valid entries found in the CSV.';
    default: return key;
  }
};

/** Result of parsing an import file. */
export interface ImportResult {
  periods: Omit<VacationPeriod, 'id'>[];
  errors: string[];
}

/** Parse a CSV string into an array of rows (each row is string[]). */
function parseCSVRows(csv: string): string[][] {
  // Strip BOM if present
  const text = csv.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ';') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        if (currentRow.some((f) => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r' && next === '\n') i++; // skip \n in \r\n
      } else {
        currentField += char;
      }
    }
  }

  // Last field / row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/** Parse a CSV file and return vacation periods. */
export function parseImportCSV(csv: string, t: ImportMessage = defaultImportMessage): ImportResult {
  const periods: Omit<VacationPeriod, 'id'>[] = [];
  const errors: string[] = [];

  const rows = parseCSVRows(csv);
  if (rows.length === 0) {
    return { periods, errors: [t('csv.emptyFile')] };
  }

  // Find header row (skip blank lines, look for our columns)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const first = rows[i][0]?.toLowerCase().trim() || '';
    if (first === 'startdatum' || first === 'start date' || first === 'start') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      periods,
      errors: [t('csv.missingHeader')],
    };
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const startCol = header.findIndex((h) => h === 'startdatum' || h === 'start date' || h === 'start');
  const endCol = header.findIndex((h) => h === 'enddatum' || h === 'end date' || h === 'ende' || h === 'end');
  const noteCol = header.findIndex((h) => h === 'notiz' || h === 'note' || h === 'bemerkung');
  const typeCol = header.findIndex((h) => h === 'type' || h === 'typ' || h === 'urlaubstyp');
  const halfDayCol = header.findIndex((h) => h === 'halber tag' || h === 'halbtag' || h === 'half day' || h === 'halber');

  if (startCol === -1 || endCol === -1) {
    return {
      periods,
      errors: [t('csv.missingColumns')],
    };
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (row.length === 0 || row.every((c) => c.trim() === '')) continue;

    const startStr = row[startCol]?.trim();
    const endStr = row[endCol]?.trim();

    if (!startStr || !endStr) {
      errors.push(t('csv.missingColumns'));
      continue;
    }

    const startDate = parseDate(startStr);
    const endDate = parseDate(endStr);

    if (!startDate) {
      errors.push(t('csv.invalidDate', { row: i + 1, value: startStr }));
      continue;
    }
    if (!endDate) {
      errors.push(t('csv.invalidEndDate', { row: i + 1, value: endStr }));
      continue;
    }

    const rawNote = noteCol >= 0 ? (row[noteCol] || '').trim() : '';
    // Reverse the export-side formula guard so notes survive a round trip.
    const note = /^'[=+\-@]/.test(rawNote) ? rawNote.slice(1) : rawNote;
    const rawType = typeCol >= 0 ? (row[typeCol] || '').trim() : '';
    const type = VACATION_TYPES.includes(rawType as VacationType) ? (rawType as VacationType) : undefined;
    let halfDay = false;
    if (halfDayCol >= 0) {
      const val = (row[halfDayCol] || '').trim().toLowerCase();
      halfDay = val === 'ja' || val === 'yes' || val === 'j' || val === '1' || val === 'true' || val === 'wahr';
    }

    periods.push({
      startDate,
      endDate,
      note,
      ...(type !== undefined && { type }),
      halfDay: halfDay && startDate === endDate,
    });
  }

  if (periods.length === 0 && errors.length === 0) {
    errors.push(t('csv.noEntries'));
  }

  return { periods, errors };
}

/** Parse flexible date formats into YYYY-MM-DD. */
function parseDate(raw: string): string | null {
  const s = raw.trim();

  // Already ISO format: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidDate(y, m, d)) {
      return s;
    }
  }

  // German format: DD.MM.YYYY or D.M.YYYY or DD.MM.YY
  const deMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (deMatch) {
    const d = Number(deMatch[1]);
    const m = Number(deMatch[2]);
    let y = Number(deMatch[3]);
    if (y < 100) y += 2000; // assume 20xx for two-digit years
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    if (isValidDate(y, m, d)) {
      return `${y}-${mm}-${dd}`;
    }
  }

  // US format: MM/DD/YYYY or M/D/YYYY
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const m = Number(usMatch[1]);
    const d = Number(usMatch[2]);
    let y = Number(usMatch[3]);
    if (y < 100) y += 2000;
    if (isValidDate(y, Number(m), Number(d))) {
      const dd = String(Number(d)).padStart(2, '0');
      const mm = String(Number(m)).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    }
  }

  return null;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
