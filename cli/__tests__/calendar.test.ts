// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import type { ListedPeriod } from '../format'
import { runCalendar } from '../commands/calendar'
import { UsageError } from '../errors'

function clientReturning(periods: ListedPeriod[], holidays: { date: string; name: string }[]) {
  const request = vi.fn(async (path: string) => {
    if (path.startsWith('/periods')) return periods as unknown
    if (path.startsWith('/holidays')) return holidays as unknown
    return { state: 'HE' } as unknown // /settings
  })
  return { client: { request } as unknown as ApiClient, request }
}

function period(startDate: string, endDate: string, extra: Partial<ListedPeriod> = {}): ListedPeriod {
  return { id: `${startDate}_${endDate}`, startDate, endDate, note: '', type: 'urlaub', ...extra } as ListedPeriod
}

const HOLIDAYS = [{ date: '2026-01-01', name: 'Neujahr' }]
const JULY_VACATION = [period('2026-07-06', '2026-07-10')]

describe('runCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches periods, holidays and settings for the year', async () => {
    const { client, request } = clientReturning([], [])

    await runCalendar(client, { year: 2026, color: false })

    expect(request).toHaveBeenCalledWith('/periods?year=2026')
    expect(request).toHaveBeenCalledWith('/holidays?year=2026')
    expect(request).toHaveBeenCalledWith('/settings')
  })

  it('renders a full-year German grid with the state name and shades vacation + holidays', async () => {
    const { client } = clientReturning(JULY_VACATION, HOLIDAYS)

    const output = await runCalendar(client, { year: 2026, color: false })

    expect(output).toContain('2026 — Hessen')
    expect(output).toContain('Jan')
    expect(output).toContain('Jul')
    expect(output).toContain('Mo Di Mi Do Fr Sa So')
    expect(output).toContain('█') // a vacation day in July
    expect(output).toContain('★') // the New Year holiday
    expect(output).toContain('vacation') // legend
  })

  it('emits no ANSI escapes when color is disabled', async () => {
    const { client } = clientReturning(JULY_VACATION, HOLIDAYS)

    const output = await runCalendar(client, { year: 2026, color: false })

    expect(output).not.toContain('\x1b')
  })

  it('emits ANSI escapes when color is enabled', async () => {
    const { client } = clientReturning(JULY_VACATION, HOLIDAYS)

    const output = await runCalendar(client, { year: 2026, color: true })

    expect(output).toContain('\x1b[')
  })

  it('renders a single month with --month', async () => {
    const { client } = clientReturning([], HOLIDAYS)

    const output = await runCalendar(client, { year: 2026, month: 1, color: false })

    expect(output).toContain('Januar 2026 — Hessen')
    expect(output).toContain('★') // New Year falls in January
    expect(output).not.toContain('Februar')
  })

  it('rejects an out-of-range month with a UsageError', async () => {
    const { client } = clientReturning([], [])

    await expect(runCalendar(client, { year: 2026, month: 13, color: false })).rejects.toThrow(UsageError)
  })
})
