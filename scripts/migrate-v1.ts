/**
 * Migration script: import v1 CSV exports into the v2 SQLite database.
 *
 * Usage: npx tsx scripts/migrate-v1.ts <path-to-csv> [--db <db-path>]
 *
 * Idempotent: running twice on the same CSV won't create duplicates.
 * Periods are matched by (startDate, endDate, note, halfDay, type).
 */

import { readFileSync } from 'node:fs';
import { createDb, createPeriod } from '../server/db';
import type { CreatePeriodInput } from '../server/types';

// Re-use the CSV parser from the frontend utilities
// We need a minimal translation function since we're not in a React context
function t(key: string, params?: Record<string, string | number>): string {
  // Minimal translations for CLI output
  const strings: Record<string, string> = {
    'csv.emptyFile': 'File is empty.',
    'csv.missingHeader': 'No header row found.',
    'csv.missingColumns': 'Missing required columns.',
    'csv.invalidDate': 'Row {row}: Invalid start date "{value}".',
    'csv.invalidEndDate': 'Row {row}: Invalid end date "{value}".',
    'csv.noEntries': 'No entries found.',
    'csv.yes': 'Ja',
    'csv.no': 'Nein',
  };
  let result = strings[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}

// ── CSV Parser (minimal copy from src/utils/export.ts to avoid React deps) ──

function parseCSVRows(csv: string): string[][] {
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
        i++;
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
        if (char === '\r' && next === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]), m = Number(isoMatch[2]), d = Number(isoMatch[3]);
    if (isValidDate(y, m, d)) return s;
  }

  const deMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (deMatch) {
    const d = Number(deMatch[1]), m = Number(deMatch[2]);
    let y = Number(deMatch[3]);
    if (y < 100) y += 2000;
    const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
    if (isValidDate(y, m, d)) return `${y}-${mm}-${dd}`;
  }

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const m = Number(usMatch[1]), d = Number(usMatch[2]);
    let y = Number(usMatch[3]);
    if (y < 100) y += 2000;
    if (isValidDate(y, m, d)) {
      return `${y}-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
    }
  }

  return null;
}

function parseImportCSV(csv: string): { periods: CreatePeriodInput[]; errors: string[] } {
  const periods: CreatePeriodInput[] = [];
  const errors: string[] = [];

  const rows = parseCSVRows(csv);
  if (rows.length === 0) {
    return { periods, errors: [t('csv.emptyFile')] };
  }

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const first = rows[i][0]?.toLowerCase().trim() || '';
    if (first === 'startdatum' || first === 'start date' || first === 'start') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return { periods, errors: [t('csv.missingHeader')] };
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const startCol = header.findIndex((h) => h === 'startdatum' || h === 'start date' || h === 'start');
  const endCol = header.findIndex((h) => h === 'enddatum' || h === 'end date' || h === 'ende' || h === 'end');
  const noteCol = header.findIndex((h) => h === 'notiz' || h === 'note' || h === 'bemerkung');
  const halfDayCol = header.findIndex((h) => h === 'halber tag' || h === 'halbtag' || h === 'half day' || h === 'halber');

  if (startCol === -1 || endCol === -1) {
    return { periods, errors: [t('csv.missingColumns')] };
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => c.trim() === '')) continue;

    const startStr = row[startCol]?.trim();
    const endStr = row[endCol]?.trim();

    if (!startStr || !endStr) continue;

    const startDate = parseDate(startStr);
    const endDate = parseDate(endStr);

    if (!startDate) {
      errors.push(`Row ${i + 1}: invalid start date "${startStr}"`);
      continue;
    }
    if (!endDate) {
      errors.push(`Row ${i + 1}: invalid end date "${endStr}"`);
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
      halfDay: halfDay && startDate === endDate,
      type: 'urlaub',
    });
  }

  if (periods.length === 0 && errors.length === 0) {
    errors.push(t('csv.noEntries'));
  }

  return { periods, errors };
}

// ── Main migration logic ──

function main() {
  const args = process.argv.slice(2);
  const csvPath = args[0];
  let dbPath = 'data/my-holiday.db';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPath = args[i + 1];
      break;
    }
  }

  if (!csvPath) {
    console.error('Usage: npx tsx scripts/migrate-v1.ts <path-to-csv> [--db <db-path>]');
    process.exit(1);
  }

  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(`Error: cannot read file "${csvPath}"`);
    process.exit(1);
  }

  const { periods, errors } = parseImportCSV(csvContent);

  if (errors.length > 0) {
    for (const e of errors) {
      if (e === t('csv.noEntries') || e === t('csv.emptyFile')) {
        console.log('ℹ️  No entries to import.');
        process.exit(0);
      }
      console.warn(`⚠️  ${e}`);
    }
  }

  if (periods.length === 0) {
    console.log('ℹ️  No entries to import.');
    process.exit(0);
  }

  const db = createDb(dbPath);

  let imported = 0;
  let skipped = 0;

  // Use a transaction for speed
  const checkExisting = db.prepare(
    'SELECT id FROM periods WHERE start_date = ? AND end_date = ? AND note = ? AND half_day = ? AND type = ?'
  );

  const insertAll = db.transaction(() => {
    for (const period of periods) {
      const existing = checkExisting.get(
        period.startDate,
        period.endDate,
        period.note,
        period.halfDay ? 1 : 0,
        period.type || 'urlaub'
      );

      if (existing) {
        skipped++;
        continue;
      }

      createPeriod(db, period);
      imported++;
    }
  });

  insertAll();

  console.log(`✅ Imported ${imported} period(s).`);
  if (skipped > 0) {
    console.log(`⏭️  Skipped ${skipped} duplicate(s).`);
  }
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} warning(s).`);
  }

  db.close();
}

main();
