import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GermanState } from './holidays';

export interface SchoolHolidayPeriod {
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
}

/**
 * Built-in fallback data for 2025–2026 (all states).
 * Source: Kultusministerkonferenz (kmk.org).
 */
const FALLBACK_DATA: Record<string, SchoolHolidayPeriod[]> = {
  'HE-2025': [
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-21' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-10' },
  ],
  'HE-2026': [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
    { name: 'Herbstferien', start: '2026-10-05', end: '2026-10-16' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-09' },
  ],
};

// Default fallback for any state — uses Hessen data if no specific data exists
function getFallbackForState(state: GermanState, year: number): SchoolHolidayPeriod[] {
  const key = `${state}-${year}`;
  if (FALLBACK_DATA[key]) return FALLBACK_DATA[key];
  // Return empty for unknown state/year combinations
  return [];
}

const API_BASE = 'https://ferien-api.de/api/v1/holidays';

const ISO_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;

/** Accept only entries with a string name and ISO-prefixed start/end dates. */
function isValidPeriod(value: unknown): value is SchoolHolidayPeriod {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.name === 'string' &&
    typeof p.start === 'string' && ISO_DATE_PREFIX_RE.test(p.start) &&
    typeof p.end === 'string' && ISO_DATE_PREFIX_RE.test(p.end)
  );
}

/**
 * Fetch school holidays from ferien-api.de for a state and year.
 * Malformed entries are dropped; if the API is unreachable or the response
 * has an unexpected shape, built-in fallback data is used.
 */
export async function fetchSchoolHolidays(
  state: GermanState,
  year: number
): Promise<SchoolHolidayPeriod[]> {
  try {
    const res = await fetch(`${API_BASE}/${state}/${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response shape');

    return data
      .filter(isValidPeriod)
      .map((h) => ({ name: h.name, start: h.start, end: h.end }));
  } catch {
    // API unavailable — use fallback
    return getFallbackForState(state, year);
  }
}

/** Parse the date part of an ISO string as a local date. */
function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDayISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// A school-holiday period longer than this is a corrupt API response, not a
// holiday — skip it instead of expanding it into the day set.
const MAX_PERIOD_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build the set of school-holiday days (YYYY-MM-DD) for a state,
 * covering [year-1, year+1] so year-boundary periods are complete.
 */
export async function buildSchoolHolidayDaySet(
  state: GermanState,
  year: number
): Promise<Set<string>> {
  const days = new Set<string>();
  for (const y of [year - 1, year, year + 1]) {
    const periods = await fetchSchoolHolidays(state, y);
    for (const p of periods) {
      const start = parseDay(p.start);
      const end = parseDay(p.end);
      if ((end.getTime() - start.getTime()) / DAY_MS > MAX_PERIOD_DAYS) continue;
      const current = new Date(start);
      while (current <= end) {
        days.add(toDayISO(current));
        current.setDate(current.getDate() + 1);
      }
    }
  }
  return days;
}

/**
 * React hook: predicate telling whether a date falls in a school holiday.
 * Backed by TanStack Query, so components re-render when the data arrives
 * (the previous module-level cache returned false until an unrelated render).
 */
export function useSchoolHolidays(state: GermanState, year: number): (date: Date) => boolean {
  const { data } = useQuery({
    queryKey: ['schoolHolidays', state, year],
    queryFn: () => buildSchoolHolidayDaySet(state, year),
    staleTime: Infinity,
  });
  return useCallback((date: Date) => data?.has(toDayISO(date)) ?? false, [data]);
}
