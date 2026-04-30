import { describe, it, expect } from 'vitest';
import type { VacationPeriod } from '../types';
import {
  computeProRataEntitlement,
  countFullCalendarMonths,
  computeLeaveReduction,
} from './entitlement';

// ============================================================
// computeProRataEntitlement
// ============================================================
describe('computeProRataEntitlement', () => {
  it('returns full entitlement when employmentStartDate is empty (not set)', () => {
    expect(computeProRataEntitlement('', '', 2026, 30)).toBe(30);
  });

  it('returns full entitlement when start date is empty and end date is set', () => {
    // If no start date but end date is set, treat as full year still
    expect(computeProRataEntitlement('', '2026-06-30', 2026, 30)).toBe(30);
  });

  it('returns full entitlement when employed for 6+ months by Jan 1 of the year', () => {
    // Started Jul 1 2025 → by Jan 1 2026 that's 6 full months (Jul–Dec 2025)
    expect(computeProRataEntitlement('2025-07-01', '', 2026, 30)).toBe(30);
  });

  it('returns full entitlement when start was before the year (12 months in year)', () => {
    // Started Jul 15 2025 → for 2026: Jan–Dec = 12 months → ≥ 6 → full
    expect(computeProRataEntitlement('2025-07-15', '', 2026, 30)).toBe(30);
  });

  it('returns full entitlement when start was late previous year (12 months in year)', () => {
    // Started Oct 1 2025 → for 2026: Jan–Dec = 12 months → ≥ 6 → full
    expect(computeProRataEntitlement('2025-10-01', '', 2026, 30)).toBe(30);
  });

  it('returns pro-rata for < 6 months in the year (start Aug 1)', () => {
    // Start 2026-08-01 → months in 2026: Aug–Dec = 5 months → 5/12 * 30 = 12.5 → 12
    expect(computeProRataEntitlement('2026-08-01', '', 2026, 30)).toBe(12);
  });

  it('returns pro-rata for < 6 months in the year (start Nov 15)', () => {
    // Start 2026-11-15 → full months in 2026: Dec = 1 → 1/12 * 30 = 2.5 → 2
    expect(computeProRataEntitlement('2026-11-15', '', 2026, 30)).toBe(2);
  });

  it('returns full entitlement for start in April (9 months → ≥6)', () => {
    expect(computeProRataEntitlement('2026-04-01', '', 2026, 30)).toBe(30);
  });

  it('returns full entitlement for start mid-month when still ≥6 months in year', () => {
    // Start Apr 15 → months May–Dec = 8 → ≥ 6 → full
    expect(computeProRataEntitlement('2026-04-15', '', 2026, 30)).toBe(30);
  });

  it('returns 0 when employment starts after the target year', () => {
    expect(computeProRataEntitlement('2027-01-01', '', 2025, 30)).toBe(0);
  });

  it('handles employment end within the year (first half)', () => {
    // End date 2026-03-31 → months in 2026: Jan,Feb,Mar = 3 → 3/12 * 30 = 7
    const result = computeProRataEntitlement('2025-01-01', '2026-03-31', 2026, 30);
    expect(result).toBe(7);
  });

  it('handles employment end mid-month (partial month not counted)', () => {
    // End 2026-03-15 → full months in 2026: Jan,Feb = 2 → 2/12 * 30 = 5
    const result = computeProRataEntitlement('2025-01-01', '2026-03-15', 2026, 30);
    expect(result).toBe(5);
  });

  it('returns full entitlement when leaving in second half of year', () => {
    // End 2026-07-01 → 6 months (Jan–Jun) → but the rule is "second half = full"?
    // Actually, plan says: full after 6 months. If leaving Jul 1, that's 6 full months (Jan–Jun = 6) → full
    // But wait, leaving Jul 1 means last day = Jul 1, so June was the last full month = 6 months
    // Hmm, but if leaving Jul 1, the employee worked through Jun 30, which is 6 months
    // According to German law: if leaving in second half → full entitlement
    // Let me test: Jul 1 → that's technically in the second half? The rule says second half starts Jul 1
    // For simplicity: >= 6 full months in the year → full
    const result = computeProRataEntitlement('2025-01-01', '2026-07-01', 2026, 30);
    // Jul 1 end means June is the last full month → Jan–Jun = 6 months
    expect(result).toBe(30);
  });

  it('returns 0 when employment ends before the target year', () => {
    expect(computeProRataEntitlement('2024-01-01', '2024-12-31', 2025, 30)).toBe(0);
  });

  it('handles employment entirely within the year (start=Jan, end=Jun)', () => {
    // Jan–Jun = 6 months → full entitlement? Or 6/12 * 30 = 15?
    // Actually >= 6 months means full entitlement
    const result = computeProRataEntitlement('2026-01-01', '2026-06-30', 2026, 30);
    expect(result).toBe(30);
  });

  it('handles very short employment (1 month)', () => {
    // Start Feb 1, End Feb 15 → 0 full months (Feb 1 to Feb 15 is partial) → 0/12 = 0
    const result = computeProRataEntitlement('2026-02-01', '2026-02-15', 2026, 30);
    expect(result).toBe(0);
  });

  it('handles non-standard totalDays (e.g., 24 days)', () => {
    // 4 months → 4/12 * 24 = 8
    const result = computeProRataEntitlement('2026-09-01', '', 2026, 24);
    expect(result).toBe(8);
  });

  it('floors fractional results', () => {
    // 5 months → 5/12 * 30 = 12.5 → floor to 12
    const result = computeProRataEntitlement('2026-08-01', '', 2026, 30);
    expect(result).toBe(12);
  });

  it('returns full entitlement when start date is exactly Jan 1 (full year)', () => {
    expect(computeProRataEntitlement('2026-01-01', '', 2026, 30)).toBe(30);
  });

  it('returns full entitlement when start was before the year and no end date', () => {
    expect(computeProRataEntitlement('2020-01-01', '', 2026, 30)).toBe(30);
  });
});

// ============================================================
// countFullCalendarMonths
// ============================================================
describe('countFullCalendarMonths', () => {
  it('returns 0 when the period covers no full month', () => {
    // Jan 15 to Feb 15: neither January nor February is fully covered
    expect(countFullCalendarMonths('2026-01-15', '2026-02-15', 2026)).toBe(0);
  });

  it('returns 1 when the period covers exactly one full month', () => {
    // Jan 1 to Jan 31
    expect(countFullCalendarMonths('2026-01-01', '2026-01-31', 2026)).toBe(1);
  });

  it('returns 2 when the period covers two full months', () => {
    // Jan 1 to Feb 28 (2026 is not a leap year)
    expect(countFullCalendarMonths('2026-01-01', '2026-02-28', 2026)).toBe(2);
  });

  it('counts March as a full month (31 days)', () => {
    // Keep the period to just March
    expect(countFullCalendarMonths('2026-03-01', '2026-03-31', 2026)).toBe(1);
  });

  it('clips to the target year boundaries', () => {
    // Period spans Dec 15 2025 to Feb 15 2026 → within 2026: Jan 1 – Feb 15
    // Jan 1 to Jan 31 is a full month = 1
    expect(countFullCalendarMonths('2025-12-15', '2026-02-15', 2026)).toBe(1);
  });

  it('returns 0 when period is entirely outside the target year', () => {
    expect(countFullCalendarMonths('2025-01-01', '2025-01-31', 2026)).toBe(0);
  });

  it('handles period entirely within the target year', () => {
    // Mar 1 to May 31 = 3 full months
    expect(countFullCalendarMonths('2026-03-01', '2026-05-31', 2026)).toBe(3);
  });

  it('covers the full year', () => {
    expect(countFullCalendarMonths('2026-01-01', '2026-12-31', 2026)).toBe(12);
  });

  it('handles leap year February', () => {
    // Feb 1 to Feb 29 (2024 is a leap year)
    expect(countFullCalendarMonths('2024-02-01', '2024-02-29', 2024)).toBe(1);
  });

  it('does not count a month if only the 1st is covered', () => {
    // Feb 1 to Feb 1 = 0 full months (not the full month)
    expect(countFullCalendarMonths('2026-02-01', '2026-02-01', 2026)).toBe(0);
  });

  it('does not count a month if day 1 is missing but rest is covered', () => {
    // Jan 2 to Jan 31 = 0 full months (missing Jan 1)
    expect(countFullCalendarMonths('2026-01-02', '2026-01-31', 2026)).toBe(0);
  });

  it('does not count a month if last day is missing', () => {
    // Jan 1 to Jan 30 = 0 full months (missing Jan 31)
    expect(countFullCalendarMonths('2026-01-01', '2026-01-30', 2026)).toBe(0);
  });
});

// ============================================================
// computeLeaveReduction
// ============================================================
describe('computeLeaveReduction', () => {
  const makePeriod = (
    startDate: string,
    endDate: string,
    type: VacationPeriod['type']
  ): VacationPeriod => ({
    id: 'test',
    startDate,
    endDate,
    note: '',
    type,
  });

  it('returns 0 when there are no periods', () => {
    expect(computeLeaveReduction([], 2026, 30)).toBe(0);
  });

  it('returns 0 for vacation periods of type "urlaub"', () => {
    const periods = [makePeriod('2026-03-01', '2026-03-31', 'urlaub')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(0);
  });

  it('reduces by 1/12 for one full calendar month of unpaid leave', () => {
    // One full month of unpaid leave → 30/12 = 2.5 days → floor to 2
    const periods = [makePeriod('2026-03-01', '2026-03-31', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(2);
  });

  it('reduces by 2/12 for two full calendar months of unpaid leave', () => {
    // Mar + Apr = 2 full months → 2 * 30/12 = 5
    const periods = [makePeriod('2026-03-01', '2026-04-30', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(5);
  });

  it('reduces by 1/12 for one full calendar month of parental leave', () => {
    const periods = [makePeriod('2026-06-01', '2026-06-30', 'elternzeit')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(2);
  });

  it('does not count partial months (no combining)', () => {
    // Jan 15 to Feb 14: 0 full months → 0 reduction
    const periods = [makePeriod('2026-01-15', '2026-02-14', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(0);
  });

  it('sums reductions across multiple leave periods', () => {
    // Mar (1 full month) + Jul (1 full month) = 2 months total → 5 days
    const periods = [
      makePeriod('2026-03-01', '2026-03-31', 'unbezahlterUrlaub'),
      makePeriod('2026-07-01', '2026-07-31', 'unbezahlterUrlaub'),
    ];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(5);
  });

  it('combines unpaid leave and parental leave reductions', () => {
    // 1 month unpaid + 1 month parental = 2 months → 5 days
    const periods = [
      makePeriod('2026-03-01', '2026-03-31', 'unbezahlterUrlaub'),
      makePeriod('2026-05-01', '2026-05-31', 'elternzeit'),
    ];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(5);
  });

  it('clips leave periods to the target year', () => {
    // Period: Dec 15 2025 to Jan 31 2026 → within 2026: Jan 1-31 = 1 full month
    const periods = [makePeriod('2025-12-15', '2026-01-31', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(2);
  });

  it('ignores leave reduction types that are not unpaid/parental', () => {
    // sabbatical is not a reduction type according to plan ("All other types are informational")
    const periods = [makePeriod('2026-03-01', '2026-03-31', 'sabbatical')];
    expect(computeLeaveReduction(periods, 2026, 30)).toBe(0);
  });

  it('uses non-standard totalDays', () => {
    // 24 days/yr → 1 month reduction = 24/12 = 2
    const periods = [makePeriod('2026-03-01', '2026-03-31', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 24)).toBe(2);
  });

  it('floors fractional reductions', () => {
    // 1 month of 25 days/yr → 25/12 = 2.083 → 2
    const periods = [makePeriod('2026-03-01', '2026-03-31', 'unbezahlterUrlaub')];
    expect(computeLeaveReduction(periods, 2026, 25)).toBe(2);
  });
});
