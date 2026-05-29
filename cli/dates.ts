/**
 * Tiny, dependency-free date helpers for the CLI. Deliberately NOT imported from
 * `src/utils/calendar.ts` — that module pulls in feiertagejs, and the CLI must
 * stay free of server-side computation (ADR-0001 / ADR-0002).
 *
 * All helpers work in UTC so output is deterministic regardless of the runner's
 * timezone, matching the UTC date math used elsewhere in the CLI (see format.ts).
 */

const MS_PER_DAY = 86_400_000

/** Today's date as an ISO `YYYY-MM-DD` string (UTC). */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Whole days from `fromISO` to `toISO` (negative if `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`)
  const to = Date.parse(`${toISO}T00:00:00Z`)
  return Math.round((to - from) / MS_PER_DAY)
}
