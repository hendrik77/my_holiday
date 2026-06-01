// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { daysBetween, todayISO } from '../dates'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

describe('todayISO', () => {
  it('returns the local calendar date, not the UTC date', () => {
    // 22:30 UTC is already the next day in Europe/Berlin (UTC+2 in summer),
    // which the test suite pins as TZ (see vite.config.ts).
    const instant = new Date('2026-06-01T22:30:00Z')
    const localExpected = `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`

    // Guard: under the pinned TZ this instant's local date differs from its UTC
    // date, so the next assertion genuinely distinguishes local from UTC.
    expect(todayISO(instant)).not.toBe(instant.toISOString().slice(0, 10))
    expect(todayISO(instant)).toBe(localExpected)
  })

  it('defaults to the current date in YYYY-MM-DD form', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('daysBetween', () => {
  it('counts whole days from start to end', () => {
    expect(daysBetween('2026-06-15', '2026-07-01')).toBe(16)
  })

  it('is negative when the target is earlier', () => {
    expect(daysBetween('2026-07-01', '2026-06-15')).toBe(-16)
  })
})
