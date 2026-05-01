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

// ── Runtime API cache ──────────────────────────────────────────────

const API_BASE = 'https://ferien-api.de/api/v1/holidays';

/** In-memory cache: day ISO → holiday period name */
const dayCache = new Map<string, string>();

/** Set of state+year keys already fetched (to avoid re-fetching) */
const fetchedKeys = new Set<string>();

/**
 * Fetch school holidays from ferien-api.de for a state and year.
 * Returns an array of { name, start, end } objects.
 * Falls back to built-in data if the API is unreachable.
 */
export async function fetchSchoolHolidays(
  state: GermanState,
  year: number
): Promise<SchoolHolidayPeriod[]> {
  const key = `${state}-${year}`;

  try {
    const res = await fetch(`${API_BASE}/${state}/${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as Array<{
      name: string;
      start: string;
      end: string;
    }>;

    return data.map((h) => ({
      name: h.name,
      start: h.start,
      end: h.end,
    }));
  } catch {
    // API unavailable — use fallback
    return getFallbackForState(state, year);
  }
}

/**
 * Build the day-level cache for a state covering [year-1, year+1].
 * Fetches from the API, caches each day → period name.
 */
async function buildDayCache(state: GermanState, year: number): Promise<void> {
  const cacheKey = `${state}-${year}`;
  if (fetchedKeys.has(cacheKey)) return;

  for (const y of [year - 1, year, year + 1]) {
    const periods = await fetchSchoolHolidays(state, y);
    for (const p of periods) {
      const start = new Date(p.start);
      const end = new Date(p.end);
      const current = new Date(start);
      while (current <= end) {
        const iso = toDayISO(current);
        dayCache.set(iso, p.name);
        current.setDate(current.getDate() + 1);
      }
    }
  }

  fetchedKeys.add(cacheKey);
}

function toDayISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Synchronous check (used by components) ────────────────────────

let _pendingPromise: Promise<void> | null = null;
let _pendingKey = '';

/**
 * Check if a date is a school holiday for the given state.
 *
 * Triggers an async fetch on first call for a state+year combination.
 * Returns false immediately if the data hasn't been loaded yet.
 */
export function isSchoolHoliday(date: Date, state: GermanState): boolean {
  const year = date.getFullYear();
  const cacheKey = `${state}-${year}`;

  // Trigger async fetch if not yet loaded
  if (!fetchedKeys.has(cacheKey)) {
    if (!_pendingPromise || _pendingKey !== cacheKey) {
      _pendingKey = cacheKey;
      _pendingPromise = buildDayCache(state, year);
    }
    return false;
  }

  const iso = toDayISO(date);
  return dayCache.has(iso);
}

/**
 * Preload school holiday data for a state+year.
 * Call this early (e.g. when state changes) to ensure data is ready.
 */
export function preloadSchoolHolidays(state: GermanState, year: number): void {
  _pendingKey = `${state}-${year}`;
  _pendingPromise = buildDayCache(state, year);
}
