import { getHolidayMap } from '../data/holidays';
import type { GermanState } from '../data/holidays';

/** Cache for holiday maps per year range + state */
let _holidayMap: Map<string, string> | null = null;
let _holidayMapRange: [number, number] | null = null;
let _holidayMapState: GermanState | null = null;

function ensureHolidayMap(year: number, state: GermanState): Map<string, string> {
  const from = year - 1;
  const to = year + 1;
  if (
    !_holidayMap ||
    !_holidayMapRange ||
    _holidayMapState !== state ||
    _holidayMapRange[0] > from ||
    _holidayMapRange[1] < to
  ) {
    _holidayMap = getHolidayMap(from, to, state);
    _holidayMapRange = [from, to];
    _holidayMapState = state;
  }
  return _holidayMap;
}

/** Check if a given date is a public holiday in Hesse */
export function isPublicHoliday(date: Date, state: GermanState): boolean {
  const map = ensureHolidayMap(date.getFullYear(), state);
  return map.has(toISODate(date));
}

/** Get holiday name for a date, or null */
export function getHolidayName(date: Date, state: GermanState): string | null {
  const map = ensureHolidayMap(date.getFullYear(), state);
  return map.get(toISODate(date)) ?? null;
}

/**
 * Compute the carry-over days to bring into `year` from the previous year.
 * Returns max(0, totalDays − workDaysUsedInPrevYear).
 * Returns 0 if there is no vacation data for the previous year (avoids
 * inflating carry-over when the user simply hasn't entered data yet).
 */
export function computeAutoCarryOver(
  periods: { startDate: string; endDate: string; halfDay?: boolean }[],
  prevYear: number,
  state: GermanState,
  totalDays: number
): number {
  const yearStart = `${prevYear}-01-01`;
  const yearEnd = `${prevYear}-12-31`;
  const prevYearPeriods = periods.filter(
    (p) => p.endDate >= yearStart && p.startDate <= yearEnd
  );
  if (prevYearPeriods.length === 0) return 0;
  const used = prevYearPeriods.reduce(
    (sum, p) => sum + countVacationWorkDaysInYear(p, prevYear, state),
    0
  );
  return Math.max(0, totalDays - used);
}

/** ISO date of the carry-over deadline for a given year (always March 31) */
export function carryOverDeadline(year: number): string {
  return `${year}-03-31`;
}

/**
 * Count how many carry-over days have been consumed.
 * Sums work days in periods that fall on or before March 31 of the given year,
 * capped at carryOverDays.
 */
export function countCarryOverUsed(
  periods: { startDate: string; endDate: string; halfDay?: boolean }[],
  year: number,
  state: GermanState,
  carryOverDays: number
): number {
  if (carryOverDays === 0) return 0;
  const yearStart = `${year}-01-01`;
  const deadline = carryOverDeadline(year);
  let total = 0;
  for (const p of periods) {
    const clippedStart = p.startDate > yearStart ? p.startDate : yearStart;
    const clippedEnd = p.endDate < deadline ? p.endDate : deadline;
    if (clippedStart > clippedEnd) continue;
    total += countVacationWorkDays(
      { startDate: clippedStart, endDate: clippedEnd, halfDay: p.halfDay && p.startDate === p.endDate },
      state
    );
  }
  return Math.min(total, carryOverDays);
}

/** Check if a date is a work day (Mon–Fri, not a public holiday) */
export function isWorkDay(date: Date, state: GermanState): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // weekend
  return !isPublicHoliday(date, state);
}

/**
 * Dec 24 (Christmas Eve) and Dec 31 (New Year's Eve) always count as
 * half days (0.5) even when booked as full vacation days.
 */
export function isSpecialHalfDay(date: Date): boolean {
  const month = date.getMonth(); // 0-based, 11 = December
  const day = date.getDate();
  return month === 11 && (day === 24 || day === 31);
}

/**
 * Check if a new vacation period overlaps with any existing period.
 * Overlap: startA <= endB && endA >= startB.
 * Optionally exclude a period by id (for editing).
 */
export function hasOverlap(
  newStart: string,
  newEnd: string,
  existing: { id: string; startDate: string; endDate: string }[],
  excludeId?: string
): boolean {
  for (const p of existing) {
    if (excludeId && p.id === excludeId) continue;
    if (newStart <= p.endDate && newEnd >= p.startDate) {
      return true;
    }
  }
  return false;
}

/** Count work days between two dates (inclusive) */
export function countWorkDays(start: Date, end: Date, state: GermanState): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endTime = new Date(end);
  endTime.setHours(0, 0, 0, 0);

  while (current <= endTime) {
    if (isWorkDay(current, state)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Count work days consumed by a vacation period.
 * - Normal work days count as 1.0
 * - Dec 24 and Dec 31 always count as 0.5 (special half days)
 * - User-flagged half-day bookings count as 0.5 (single-day periods only)
 */
export function countVacationWorkDays(period: { startDate: string; endDate: string; halfDay?: boolean }, state: GermanState): number {
  const start = parseISODate(period.startDate);
  const end = parseISODate(period.endDate);
  let total = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endTime = new Date(end);
  endTime.setHours(0, 0, 0, 0);

  while (current <= endTime) {
    if (isWorkDay(current, state)) {
      if (period.halfDay) {
        total += 0.5;
      } else if (isSpecialHalfDay(current)) {
        total += 0.5;
      } else {
        total += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return total;
}

/**
 * Count work days consumed by a vacation period, clipped to a specific year.
 * For periods that span multiple years, only the portion inside the given
 * year is counted.
 */
export function countVacationWorkDaysInYear(
  period: { startDate: string; endDate: string; halfDay?: boolean },
  year: number,
  state: GermanState
): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Clip the period to the year boundaries
  const clippedStart = period.startDate > yearStart ? period.startDate : yearStart;
  const clippedEnd = period.endDate < yearEnd ? period.endDate : yearEnd;

  // If clipped range is invalid (period is entirely outside the year), return 0
  if (clippedStart > clippedEnd) return 0;

  return countVacationWorkDays(
    { startDate: clippedStart, endDate: clippedEnd, halfDay: period.halfDay && period.startDate === period.endDate },
    state
  );
}

/** Convert Date to ISO date string YYYY-MM-DD */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse ISO date string to Date */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Get all days in a month as Date objects */
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/** Get the day of week (0=Sun) for the first day of the month */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** German month names */
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** German weekday abbreviations */
export const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Format date range for display */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;

  if (startISO === endISO) {
    return `${fmt(start)}${start.getFullYear()}`;
  }
  if (sameMonth && sameYear) {
    return `${String(start.getDate()).padStart(2, '0')}.–${fmt(end)}${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${fmt(start)}–${fmt(end)}${end.getFullYear()}`;
  }
  return `${fmt(start)}${start.getFullYear()} – ${fmt(end)}${end.getFullYear()}`;
}

/** Format single date for display */
export function formatDate(iso: string): string {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
