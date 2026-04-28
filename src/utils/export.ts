import type { VacationPeriod } from '../types';
import { countVacationWorkDays } from './calendar';

const CSV_HEADER = 'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage';

/** Export vacation data as a CSV file and trigger download */
export function downloadCSV(
  periods: VacationPeriod[],
  totalDays: number,
  year: number
): void {
  const BOM = '\uFEFF';
  const rows = [CSV_HEADER];

  for (const p of periods) {
    const workDays = countVacationWorkDays(p);
    const halfDayLabel = p.halfDay ? 'Ja' : 'Nein';
    const note = escapeCSV(p.note || '');
    rows.push(
      `${p.startDate};${p.endDate};${note};${halfDayLabel};${workDays.toString().replace('.', ',')}`
    );
  }

  const content = BOM + rows.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `urlaub-${year}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Escape a CSV field: wrap in quotes if it contains delimiter, quote, or newline */
function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Parse a CSV string into an array of rows (each row is string[]) */
function parseCSVRows(csv: string): string[][] {
  // Strip BOM if present
  const text = csv.replace(/^\uFEFF/, '').trim();
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        rows.push(current.split(';'));
        current = '';
        if (char === '\r') i++; // skip \n in \r\n
      } else if (char === '\r') {
        rows.push(current.split(';'));
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Last row (no trailing newline)
  if (current.length > 0 || rows.length === 0) {
    rows.push(current.split(';'));
  }

  return rows;
}

/** Result of parsing an import file */
export interface ImportResult {
  periods: Omit<VacationPeriod, 'id'>[];
  errors: string[];
}

/** Parse a CSV file and return vacation periods */
export function parseImportCSV(csv: string): ImportResult {
  const periods: Omit<VacationPeriod, 'id'>[] = [];
  const errors: string[] = [];

  const rows = parseCSVRows(csv);
  if (rows.length === 0) {
    return { periods, errors: ['Datei ist leer.'] };
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
      errors: [
        'Keine Kopfzeile gefunden. Erwartet: "Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage"',
      ],
    };
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const startCol = header.findIndex((h) => h === 'startdatum' || h === 'start date' || h === 'start');
  const endCol = header.findIndex((h) => h === 'enddatum' || h === 'end date' || h === 'ende' || h === 'end');
  const noteCol = header.findIndex((h) => h === 'notiz' || h === 'note' || h === 'bemerkung');
  const halfDayCol = header.findIndex((h) => h === 'halber tag' || h === 'halbtag' || h === 'half day' || h === 'halber');

  if (startCol === -1 || endCol === -1) {
    return {
      periods,
      errors: ['Spalten "Startdatum" und/oder "Enddatum" nicht gefunden.'],
    };
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip empty rows
    if (row.length === 0 || row.every((c) => c.trim() === '')) continue;

    const startStr = row[startCol]?.trim();
    const endStr = row[endCol]?.trim();

    if (!startStr || !endStr) {
      errors.push(`Zeile ${i + 1}: Start- oder Enddatum fehlt.`);
      continue;
    }

    const startDate = parseDate(startStr);
    const endDate = parseDate(endStr);

    if (!startDate) {
      errors.push(`Zeile ${i + 1}: Ungültiges Startdatum "${startStr}".`);
      continue;
    }
    if (!endDate) {
      errors.push(`Zeile ${i + 1}: Ungültiges Enddatum "${endStr}".`);
      continue;
    }

    const note = noteCol >= 0 ? (row[noteCol] || '').trim() : '';
    let halfDay = false;
    if (halfDayCol >= 0) {
      const val = (row[halfDayCol] || '').trim().toLowerCase();
      halfDay = val === 'ja' || val === 'yes' || val === 'j' || val === '1' || val === 'true' || val === 'wahr';
    }

    periods.push({
      startDate,
      endDate,
      note,
      halfDay,
    });
  }

  if (periods.length === 0 && errors.length === 0) {
    errors.push('Keine Urlaubseinträge in der Datei gefunden.');
  }

  return { periods, errors };
}

/** Parse flexible date formats into YYYY-MM-DD */
function parseDate(raw: string): string | null {
  const s = raw.trim();

  // Already ISO format: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch;
    if (isValidDate(Number(y), Number(m), Number(d))) {
      return s;
    }
  }

  // German format: DD.MM.YYYY or D.M.YYYY or DD.MM.YY
  const deMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (deMatch) {
    const [_, d, m, yRaw] = deMatch;
    let y = Number(yRaw);
    if (y < 100) y += 2000; // assume 20xx for two-digit years
    const dd = String(Number(d)).padStart(2, '0');
    const mm = String(Number(m)).padStart(2, '0');
    if (isValidDate(y, Number(m), Number(d))) {
      return `${y}-${mm}-${dd}`;
    }
  }

  // US format: MM/DD/YYYY or M/D/YYYY
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const [_, m, d, yRaw] = usMatch;
    let y = Number(yRaw);
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
