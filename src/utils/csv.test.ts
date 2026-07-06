import { describe, expect, it } from 'vitest';
import type { VacationPeriod } from '../types';
import { formatCSV, parseImportCSV } from './csv';

const CANONICAL_HEADER = 'Start Date;End Date;Note;Type;Half Day;Work Days';

describe('formatCSV', () => {
  it('emits the canonical header row as the first line', () => {
    const csv = formatCSV([], 'HE');
    expect(csv.split('\n')[0]).toBe(CANONICAL_HEADER);
  });

  it('is BOM-free and uses a semicolon delimiter', () => {
    const period: VacationPeriod = {
      id: '1', startDate: '2026-07-01', endDate: '2026-07-03', note: 'x', type: 'urlaub',
    };
    const csv = formatCSV([period], 'HE');

    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.split(';')).toHaveLength(6);
  });

  it('escapes notes containing semicolons, double-quotes, and newlines', () => {
    const period: VacationPeriod = {
      id: '1', startDate: '2026-07-01', endDate: '2026-07-01', note: 'a;b"c\nd', type: 'urlaub',
    };
    const csv = formatCSV([period], 'HE');

    expect(csv).toContain('"a;b""c\nd"');
  });

  it.each(['=', '+', '-', '@'])(
    'neutralizes a note starting with %s so spreadsheets cannot execute it as a formula',
    (trigger) => {
      const period: VacationPeriod = {
        id: '1', startDate: '2026-07-01', endDate: '2026-07-01', note: `${trigger}SUM(A1:A9)`, type: 'urlaub',
      };
      const csv = formatCSV([period], 'HE');
      const noteField = csv.split('\n')[1].split(';')[2];

      expect(noteField).toBe(`'${trigger}SUM(A1:A9)`);
    },
  );

  it('leaves ordinary notes untouched', () => {
    const period: VacationPeriod = {
      id: '1', startDate: '2026-07-01', endDate: '2026-07-01', note: 'Sommerurlaub', type: 'urlaub',
    };
    const csv = formatCSV([period], 'HE');

    expect(csv.split('\n')[1].split(';')[2]).toBe('Sommerurlaub');
  });
});

describe('parseImportCSV formula guard round-trip', () => {
  it('strips the guard apostrophe added on export so notes survive a round trip', () => {
    const csv = ['Start Date;End Date;Note', "2026-07-01;2026-07-01;'=SUM(A1:A9)"].join('\n');
    const { periods, errors } = parseImportCSV(csv);

    expect(errors).toEqual([]);
    expect(periods[0].note).toBe('=SUM(A1:A9)');
  });

  it('keeps a legitimate leading apostrophe that does not guard a formula trigger', () => {
    const csv = ['Start Date;End Date;Note', "2026-07-01;2026-07-01;'quoted note"].join('\n');
    const { periods } = parseImportCSV(csv);

    expect(periods[0].note).toBe("'quoted note");
  });
});
