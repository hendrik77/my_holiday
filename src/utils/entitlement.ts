import type { VacationPeriod } from '../types';
import { parseISODate } from './calendar';

/**
 * Compute pro-rata vacation entitlement for a given year.
 *
 * Rules (§ 4 BUrlG):
 * - Full entitlement after 6 complete months of employment
 * - Otherwise 1/12 of totalDays per complete month worked
 * - Result is always floored (partial days are not granted)
 */
export function computeProRataEntitlement(
  employmentStartDate: string,
  employmentEndDate: string,
  year: number,
  totalDays: number,
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  // Determine the effective start within this year
  let effectiveStart: Date;
  if (!employmentStartDate) {
    effectiveStart = yearStart;
  } else {
    const start = parseISODate(employmentStartDate);
    effectiveStart = start > yearStart ? start : yearStart;
  }

  // Determine the effective end within this year
  let effectiveEnd: Date;
  if (!employmentEndDate) {
    effectiveEnd = yearEnd;
  } else {
    const end = parseISODate(employmentEndDate);
    effectiveEnd = end < yearEnd ? end : yearEnd;
  }

  // If employment hasn't started yet or already ended before this year
  if (effectiveStart > effectiveEnd) return 0;

  // Count complete calendar months in [effectiveStart, effectiveEnd]
  const months = countCompleteMonths(effectiveStart, effectiveEnd);

  // Full entitlement after 6 months
  if (months >= 6) return totalDays;

  // Pro-rata: floor(months / 12 * totalDays)
  return Math.floor((months / 12) * totalDays);
}

/**
 * Count the number of complete calendar months within a date range.
 * A complete month means the range covers the 1st through the last day.
 */
function countCompleteMonths(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    // We need the range to cover the full month: start <= monthStart AND end >= monthEnd
    if (start <= monthStart && end >= monthEnd) {
      count++;
    }

    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return count;
}

/**
 * Count full calendar months covered by a period within a given year.
 *
 * A "full calendar month" means the period covers the entire month from
 * the 1st day to the last day. Partial months don't count, and partial
 * months from different periods never combine (§ 17 BUrlG / § 17 BEEG).
 *
 * The period is first clipped to the year boundaries.
 */
export function countFullCalendarMonths(
  startDate: string,
  endDate: string,
  year: number,
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const start = parseISODate(startDate);
  const end = parseISODate(endDate);

  // Clip to year boundaries
  const clippedStart = start > yearStart ? start : yearStart;
  const clippedEnd = end < yearEnd ? end : yearEnd;

  if (clippedStart > clippedEnd) return 0;

  return countCompleteMonths(clippedStart, clippedEnd);
}

/**
 * Compute the total leave reduction in days for a given year.
 *
 * Only types `unbezahlterUrlaub` (§ 17 BUrlG) and `elternzeit` (§ 17 BEEG)
 * reduce entitlement. Each full calendar month reduces by 1/12 of totalDays.
 * Partial months never combine. Result is floored.
 */
export function computeLeaveReduction(
  periods: VacationPeriod[],
  year: number,
  totalDays: number,
): number {
  const reducingTypes: Array<VacationPeriod['type']> = [
    'unbezahlterUrlaub',
    'elternzeit',
    'sabbatical',
  ];

  let totalFullMonths = 0;

  for (const period of periods) {
    if (!period.type || !reducingTypes.includes(period.type)) continue;

    const months = countFullCalendarMonths(
      period.startDate,
      period.endDate,
      year,
    );
    totalFullMonths += months;
  }

  return (totalFullMonths / 12) * totalDays;
}
