import { describe, it, expect } from 'vitest';
import {
  isWorkDay,
  isPublicHoliday,
  isSpecialHalfDay,
  countWorkDays,
  countVacationWorkDays,
  toISODate,
  parseISODate,
} from './calendar';
import type { GermanState } from '../data/holidays';

const HE: GermanState = 'HE';
const BY: GermanState = 'BY';

describe('isPublicHoliday', () => {
  it('recognises nationwide holidays', () => {
    // Neujahr 2026-01-01 (Thursday)
    expect(isPublicHoliday(new Date(2026, 0, 1), HE)).toBe(true);
    // Tag der Arbeit 2026-05-01 (Friday)
    expect(isPublicHoliday(new Date(2026, 4, 1), HE)).toBe(true);
    // Tag der Deutschen Einheit 2026-10-03 (Saturday)
    expect(isPublicHoliday(new Date(2026, 9, 3), HE)).toBe(true);
    // 1. Weihnachtstag 2026-12-25 (Friday)
    expect(isPublicHoliday(new Date(2026, 11, 25), HE)).toBe(true);
  });

  it('recognises state-specific holidays', () => {
    // Fronleichnam in Hessen (2026-06-04)
    expect(isPublicHoliday(new Date(2026, 5, 4), HE)).toBe(true);
    // Heilige Drei Könige in Bayern (2026-01-06), not in Hessen
    expect(isPublicHoliday(new Date(2026, 0, 6), BY)).toBe(true);
    expect(isPublicHoliday(new Date(2026, 0, 6), HE)).toBe(false);
  });

  it('returns false for regular work days', () => {
    // A normal Tuesday in March
    expect(isPublicHoliday(new Date(2026, 2, 10), HE)).toBe(false);
  });

  it('returns false for weekends that are not holidays', () => {
    // A regular Saturday
    expect(isPublicHoliday(new Date(2026, 2, 7), HE)).toBe(false);
  });
});

describe('isWorkDay', () => {
  it('returns true for Monday–Friday that are not holidays', () => {
    // Tuesday 2026-03-10
    expect(isWorkDay(new Date(2026, 2, 10), HE)).toBe(true);
  });

  it('returns false for weekends', () => {
    expect(isWorkDay(new Date(2026, 2, 7), HE)).toBe(false); // Saturday
    expect(isWorkDay(new Date(2026, 2, 8), HE)).toBe(false); // Sunday
  });

  it('returns false for public holidays on weekdays', () => {
    // Tag der Arbeit 2026-05-01 is a Friday (holiday)
    expect(isWorkDay(new Date(2026, 4, 1), HE)).toBe(false);
  });
});

describe('isSpecialHalfDay', () => {
  it('returns true for Dec 24', () => {
    expect(isSpecialHalfDay(new Date(2026, 11, 24))).toBe(true);
  });

  it('returns true for Dec 31', () => {
    expect(isSpecialHalfDay(new Date(2026, 11, 31))).toBe(true);
  });

  it('returns false for other December dates', () => {
    expect(isSpecialHalfDay(new Date(2026, 11, 23))).toBe(false);
    expect(isSpecialHalfDay(new Date(2026, 11, 25))).toBe(false);
    expect(isSpecialHalfDay(new Date(2026, 11, 30))).toBe(false);
  });

  it('returns false for other months', () => {
    expect(isSpecialHalfDay(new Date(2026, 10, 24))).toBe(false);
    expect(isSpecialHalfDay(new Date(2026, 0, 31))).toBe(false);
  });
});

describe('countWorkDays', () => {
  it('counts weekdays in a range', () => {
    // 2026-03-09 (Mon) to 2026-03-13 (Fri) = 5 work days
    expect(countWorkDays(new Date(2026, 2, 9), new Date(2026, 2, 13), HE)).toBe(5);
  });

  it('excludes weekends', () => {
    // 2026-03-09 (Mon) to 2026-03-15 (Sun) = 5 work days
    expect(countWorkDays(new Date(2026, 2, 9), new Date(2026, 2, 15), HE)).toBe(5);
  });

  it('excludes public holidays', () => {
    // 2026-04-27 (Mon) to 2026-05-03 (Sun)
    // Mon, Tue, Wed, Thu are work days; Fri May 1 is holiday; Sat/Sun weekend = 4
    expect(countWorkDays(new Date(2026, 3, 27), new Date(2026, 4, 3), HE)).toBe(4);
  });

  it('returns 1 for a single work day', () => {
    expect(countWorkDays(new Date(2026, 2, 10), new Date(2026, 2, 10), HE)).toBe(1);
  });

  it('returns 0 for a single holiday', () => {
    expect(countWorkDays(new Date(2026, 0, 1), new Date(2026, 0, 1), HE)).toBe(0);
  });
});

describe('countVacationWorkDays', () => {
  it('counts normal work days as 1.0', () => {
    const result = countVacationWorkDays(
      { startDate: '2026-03-09', endDate: '2026-03-13' },
      HE
    );
    expect(result).toBe(5);
  });

  it('counts user half-day as 0.5', () => {
    const result = countVacationWorkDays(
      { startDate: '2026-03-10', endDate: '2026-03-10', halfDay: true },
      HE
    );
    expect(result).toBe(0.5);
  });

  it('counts Dec 24 as 0.5 even without halfDay flag', () => {
    // Dec 24, 2026 is a Thursday (work day)
    const result = countVacationWorkDays(
      { startDate: '2026-12-24', endDate: '2026-12-24' },
      HE
    );
    expect(result).toBe(0.5);
  });

  it('counts Dec 31 as 0.5', () => {
    // Dec 31, 2026 is a Thursday (work day)
    const result = countVacationWorkDays(
      { startDate: '2026-12-31', endDate: '2026-12-31' },
      HE
    );
    expect(result).toBe(0.5);
  });

  it('counts Dec 23–24 as 1.5 (23=1.0, 24=0.5)', () => {
    // Dec 23 Wed, Dec 24 Thu — both work days
    const result = countVacationWorkDays(
      { startDate: '2026-12-23', endDate: '2026-12-24' },
      HE
    );
    expect(result).toBe(1.5);
  });

  it('skips Dec 24 if it falls on a weekend', () => {
    // Dec 24, 2027 is a Friday — work day, counts as 0.5
    const result2027 = countVacationWorkDays(
      { startDate: '2027-12-24', endDate: '2027-12-24' },
      HE
    );
    expect(result2027).toBe(0.5);

    // Dec 24, 2028 is a Sunday — not a work day, counts as 0
    const result2028 = countVacationWorkDays(
      { startDate: '2028-12-24', endDate: '2028-12-24' },
      HE
    );
    expect(result2028).toBe(0);
  });

  it('halfDay does not stack with special half-day (stays 0.5)', () => {
    const result = countVacationWorkDays(
      { startDate: '2026-12-24', endDate: '2026-12-24', halfDay: true },
      HE
    );
    expect(result).toBe(0.5);
  });

  it('excludes public holidays from the count', () => {
    // Dec 24 (Thu, 0.5) to Dec 26 (Sat)
    // Dec 24 = 0.5, Dec 25 = holiday, Dec 26 = weekend = 0.5 total
    const result = countVacationWorkDays(
      { startDate: '2026-12-24', endDate: '2026-12-26' },
      HE
    );
    expect(result).toBe(0.5);
  });
});

describe('toISODate / parseISODate', () => {
  it('roundtrips correctly', () => {
    const date = new Date(2026, 6, 15);
    const iso = toISODate(date);
    expect(iso).toBe('2026-07-15');
    const parsed = parseISODate(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(15);
  });
});
