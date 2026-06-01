/**
 * Tiny, dependency-free date helpers for the CLI. Deliberately NOT imported from
 * `src/utils/calendar.ts` — that module pulls in feiertagejs, and the CLI must
 * stay free of server-side computation (ADR-0001 / ADR-0002).
 *
 * `todayISO` uses the local wall-clock date (what the user sees on the calendar);
 * `daysBetween` treats the date-only strings as UTC midnights so a whole-day span
 * is exact and DST-independent.
 */

const MS_PER_DAY = 86_400_000

/** Today's date as an ISO `YYYY-MM-DD` string in the local timezone. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Whole days from `fromISO` to `toISO` (negative if `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`)
  const to = Date.parse(`${toISO}T00:00:00Z`)
  return Math.round((to - from) / MS_PER_DAY)
}
