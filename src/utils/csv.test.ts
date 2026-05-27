import { describe, expect, it } from 'vitest';
import type { VacationPeriod } from '../types';
import { formatCSV } from './csv';

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
});
