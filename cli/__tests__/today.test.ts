// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import type { ListedPeriod, RemainingSummary } from '../format'
import { runToday } from '../commands/today'

const SUMMARY: RemainingSummary = {
  year: 2026,
  totalDays: 30,
  entitledDays: 30,
  usedDays: 12,
  carryOver: { available: 0, used: 0, expiresOn: '2026-03-31' },
  remaining: 18,
}

function clientReturning(periods: ListedPeriod[]) {
  const request = vi.fn(async (path: string) =>
    (path.startsWith('/remaining') ? SUMMARY : periods) as unknown,
  )
  return { client: { request } as unknown as ApiClient, request }
}

function period(startDate: string, endDate: string, type?: string): ListedPeriod {
  return { id: `${startDate}_${endDate}`, startDate, endDate, note: '', type } as ListedPeriod
}

describe('runToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches remaining for the current year and all periods', async () => {
    const { client, request } = clientReturning([])

    await runToday(client, {})

    expect(request).toHaveBeenCalledWith('/remaining?year=2026')
    expect(request).toHaveBeenCalledWith('/periods')
  })

  it('reports the remaining days and the next upcoming vacation', async () => {
    const { client } = clientReturning([period('2026-07-01', '2026-07-15', 'urlaub')])

    const output = await runToday(client, {})

    expect(output).toContain('18 days left')
    expect(output).toContain('next: urlaub')
    expect(output).toContain('in 16 days')
    expect(output).toContain('(2026-07-01→2026-07-15)')
  })

  it('reports an active period when today falls inside one', async () => {
    const { client } = clientReturning([period('2026-06-10', '2026-06-20', 'urlaub')])

    const output = await runToday(client, {})

    expect(output).toContain('on vacation until 2026-06-20')
  })

  it('says there is no upcoming vacation when every period is in the past', async () => {
    const { client } = clientReturning([period('2026-01-01', '2026-01-05', 'urlaub')])

    const output = await runToday(client, {})

    expect(output).toContain('no upcoming vacation')
  })

  it('emits structured JSON with --json', async () => {
    const { client } = clientReturning([period('2026-07-01', '2026-07-15', 'urlaub')])

    const parsed = JSON.parse(await runToday(client, { json: true }))

    expect(parsed.year).toBe(2026)
    expect(parsed.remaining).toBe(18)
    expect(parsed.next.startDate).toBe('2026-07-01')
    expect(parsed.daysUntilNext).toBe(16)
    expect(parsed.active).toBeNull()
  })
})
