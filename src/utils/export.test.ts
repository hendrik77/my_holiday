import { describe, it, expect } from 'vitest';
import { parseImportCSV, escapeCSV } from './export';

// Minimal t-function for testing — returns the key as-is
const t = (key: string, params?: Record<string, string | number>) => {
  if (params) {
    return key.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`));
  }
  return key;
};

describe('parseImportCSV', () => {
  it('parses ISO date format', () => {
    const csv = 'Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage\n2026-07-01;2026-07-05;Sommer;Nein;5';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-05',
      note: 'Sommer',
      halfDay: false,
    });
  });

  it('parses German date format (DD.MM.YYYY)', () => {
    const csv = 'Startdatum;Enddatum\n01.07.2026;05.07.2026';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].startDate).toBe('2026-07-01');
    expect(result.periods[0].endDate).toBe('2026-07-05');
  });

  it('parses US date format (MM/DD/YYYY)', () => {
    const csv = 'Startdatum;Enddatum\n07/01/2026;07/05/2026';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].startDate).toBe('2026-07-01');
  });

  it('parses half-day flag (Ja)', () => {
    const csv = 'Startdatum;Enddatum;Halber Tag\n2026-03-10;2026-03-10;Ja';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].halfDay).toBe(true);
  });

  it('parses half-day flag (Nein)', () => {
    const csv = 'Startdatum;Enddatum;Halber Tag\n2026-03-10;2026-03-10;Nein';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].halfDay).toBe(false);
  });

  it('parses half-day flag (1)', () => {
    const csv = 'Startdatum;Enddatum;Halber Tag\n2026-03-10;2026-03-10;1';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].halfDay).toBe(true);
  });

  it('handles minimal columns (only Startdatum + Enddatum)', () => {
    const csv = 'Startdatum;Enddatum\n2026-01-10;2026-01-15\n2026-03-01;2026-03-05';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].note).toBe('');
    expect(result.periods[0].halfDay).toBe(false);
  });

  it('skips empty rows', () => {
    const csv = 'Startdatum;Enddatum\n\n2026-01-10;2026-01-15\n\n\n2026-03-01;2026-03-05\n';
    const result = parseImportCSV(csv, t);
    expect(result.periods).toHaveLength(2);
  });

  it('handles alternative header names', () => {
    const csv = 'Start;Ende;Notiz\n2026-07-01;2026-07-05;Test';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods[0].note).toBe('Test');
  });

  it('returns error for invalid dates', () => {
    const csv = 'Startdatum;Enddatum\nabc;2026-01-01\n2026-01-01;xyz';
    const result = parseImportCSV(csv, t);
    expect(result.periods).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for empty file', () => {
    const result = parseImportCSV('', t);
    expect(result.periods).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error when no header found', () => {
    const csv = 'irgendwas;anderes\n2026-01-01;2026-01-02';
    const result = parseImportCSV(csv, t);
    expect(result.periods).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles CSV with BOM', () => {
    const csv = '\uFEFFStartdatum;Enddatum\n2026-07-01;2026-07-05';
    const result = parseImportCSV(csv, t);
    expect(result.periods).toHaveLength(1);
  });

  it('parses two-digit years (assumes 20xx)', () => {
    const csv = 'Startdatum;Enddatum\n01.07.26;05.07.26';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].startDate).toBe('2026-07-01');
  });

  it('ignores the Arbeitstage column on import', () => {
    const csv = 'Startdatum;Enddatum;Arbeitstage\n2026-01-10;2026-01-15;5';
    const result = parseImportCSV(csv, t);
    expect(result.errors).toEqual([]);
    expect(result.periods[0].startDate).toBe('2026-01-10');
  });

  it('handles quoted fields with semicolons', () => {
    const csv = 'Startdatum;Enddatum;Notiz\n2026-07-01;2026-07-05;"Urlaub; mit Familie"';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].note).toBe('Urlaub; mit Familie');
  });

  it('handles alternative half-day header names', () => {
    const csv = 'Startdatum;Enddatum;Halbtag\n2026-03-10;2026-03-10;Ja';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].halfDay).toBe(true);
  });

  it('handles missing start/end values in a row', () => {
    const csv = 'Startdatum;Enddatum\n;2026-01-15\n2026-03-01;';
    const result = parseImportCSV(csv, t);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.periods).toHaveLength(0);
  });

  it('returns noEntries error when data found but no valid periods', () => {
    const csv = 'Startdatum;Enddatum\n;\n;';
    const result = parseImportCSV(csv, t);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles escaped quotes in quoted fields', () => {
    const csv = 'Startdatum;Enddatum;Notiz\n2026-07-01;2026-07-05;"Urlaub ""Sommer"" 2026"';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].note).toBe('Urlaub "Sommer" 2026');
  });

  it('handles "half day" English header', () => {
    const csv = 'Startdatum;Enddatum;Half Day\n2026-03-10;2026-03-10;Yes';
    const result = parseImportCSV(csv, t);
    expect(result.periods[0].halfDay).toBe(true);
  });

  it('rejects CSV with start column but no end column', () => {
    const csv = 'Startdatum;Irgendwas\n2026-03-10;2026-03-15';
    const result = parseImportCSV(csv, t);
    expect(result.periods).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('escapeCSV', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCSV('Sommerurlaub')).toBe('Sommerurlaub');
  });

  it('escapes semicolons', () => {
    expect(escapeCSV('Urlaub; Sommer')).toBe('"Urlaub; Sommer"');
  });

  it('escapes double quotes', () => {
    expect(escapeCSV('Urlaub "Sommer"')).toBe('"Urlaub ""Sommer"""');
  });

  it('escapes newlines', () => {
    expect(escapeCSV('Zeile 1\nZeile 2')).toBe('"Zeile 1\nZeile 2"');
  });
});
