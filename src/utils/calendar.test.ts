import { describe, it, expect } from 'vitest';
import type { VacationPeriod } from '../types';
import {
  isWorkDay,
  isPublicHoliday,
  isSpecialHalfDay,
  countWorkDays,
  countVacationWorkDays,
  countVacationWorkDaysInYear,
  hasOverlap,
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

describe('hasOverlap', () => {
  const existing: VacationPeriod[] = [
    { id: '1', startDate: '2026-07-01', endDate: '2026-07-10', note: 'Sommer' },
    { id: '2', startDate: '2026-12-23', endDate: '2026-12-27', note: 'Weihnachten' },
  ];

  it('detects overlapping start (new starts inside existing)', () => {
    expect(hasOverlap('2026-07-05', '2026-07-15', existing)).toBe(true);
  });

  it('detects overlapping end (new ends inside existing)', () => {
    expect(hasOverlap('2026-06-25', '2026-07-05', existing)).toBe(true);
  });

  it('detects full overlap (new fully contains existing)', () => {
    expect(hasOverlap('2026-06-25', '2026-07-15', existing)).toBe(true);
  });

  it('detects exact same dates', () => {
    expect(hasOverlap('2026-07-01', '2026-07-10', existing)).toBe(true);
  });

  it('detects adjacent on start (touching boundary)', () => {
    // New ends on the day before existing starts = no overlap
    // New starts on the day after existing ends = no overlap
    expect(hasOverlap('2026-07-11', '2026-07-15', existing)).toBe(false);
    expect(hasOverlap('2026-06-25', '2026-06-30', existing)).toBe(false);
  });

  it('returns false when no overlap', () => {
    expect(hasOverlap('2026-08-01', '2026-08-10', existing)).toBe(false);
  });

  it('returns false for empty existing periods', () => {
    expect(hasOverlap('2026-07-01', '2026-07-10', [])).toBe(false);
  });

  it('excludes a period by id (for editing)', () => {
    // Overlaps with itself, but excluded
    expect(hasOverlap('2026-07-01', '2026-07-10', existing, '1')).toBe(false);
    // Still overlaps with the other period
    expect(hasOverlap('2026-07-01', '2026-12-24', existing, '1')).toBe(true);
  });

  it('single-day periods overlap correctly', () => {
    const periods: VacationPeriod[] = [
      { id: '1', startDate: '2026-06-15', endDate: '2026-06-15', note: '' },
    ];
    expect(hasOverlap('2026-06-15', '2026-06-15', periods)).toBe(true);
    expect(hasOverlap('2026-06-14', '2026-06-16', periods)).toBe(true);
    expect(hasOverlap('2026-06-16', '2026-06-16', periods)).toBe(false);
  });
});

describe('countVacationWorkDaysInYear', () => {
  const HE = 'HE' as const;

  it('counts only work days within the year', () => {
    // Dec 28 2026 (Mon) to Jan 3 2027 (Sun)
    // In 2026: Dec 28-31 = Mon-Thu = 4 work days, but Dec 31 is 0.5
    // So: 3*1.0 + 0.5 = 3.5 in 2026
    const period = { startDate: '2026-12-28', endDate: '2027-01-03' };
    expect(countVacationWorkDaysInYear(period, 2026, HE)).toBe(3.5);
    // In 2027: Jan 1 (Fri, holiday) + Jan 2-3 (Sat-Sun) = 0
    expect(countVacationWorkDaysInYear(period, 2027, HE)).toBe(0);
  });

  it('returns full count when period is fully inside the year', () => {
    const period = { startDate: '2026-07-01', endDate: '2026-07-10' };
    const full = countVacationWorkDays(period, HE);
    expect(countVacationWorkDaysInYear(period, 2026, HE)).toBe(full);
  });

  it('returns 0 when period is entirely outside the year', () => {
    const period = { startDate: '2027-06-01', endDate: '2027-06-10' };
    expect(countVacationWorkDaysInYear(period, 2026, HE)).toBe(0);
  });

  it('handles single-day period crossing year boundary', () => {
    // Should never happen in practice (single day can't cross years)
    // but should handle gracefully
    const period = { startDate: '2026-06-15', endDate: '2026-06-15', halfDay: true };
    expect(countVacationWorkDaysInYear(period, 2026, HE)).toBe(0.5);
    expect(countVacationWorkDaysInYear(period, 2025, HE)).toBe(0);
  });

  it('handles multi-year span (2026-2028)', () => {
    // Jan 1 2026 (Thu, holiday) to Jan 1 2028 (Mon, holiday)
    const period = { startDate: '2026-01-01', endDate: '2028-01-01' };
    const in2026 = countVacationWorkDaysInYear(period, 2026, HE);
    const in2027 = countVacationWorkDaysInYear(period, 2027, HE);
    // Both should be > 0
    expect(in2026).toBeGreaterThan(0);
    expect(in2027).toBeGreaterThan(0);
    // 2028: Jan 1 only, which is a holiday
    expect(countVacationWorkDaysInYear(period, 2028, HE)).toBe(0);
  });

  it('handles halfDay periods crossing years', () => {
    // Dec 31 2026 (Thu, 0.5 special) - single day
    const period = { startDate: '2026-12-31', endDate: '2026-12-31', halfDay: true };
    expect(countVacationWorkDaysInYear(period, 2026, HE)).toBe(0.5);
  });
});
