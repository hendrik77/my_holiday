// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import type { RemainingSummary } from '../format'
import { runRemaining } from '../commands/remaining'

const SUMMARY: RemainingSummary = {
  year: 2026,
  totalDays: 30,
  entitledDays: 30,
  usedDays: 12,
  carryOver: { available: 5, used: 3, expiresOn: '2026-03-31' },
  remaining: 18,
}

function clientReturning(summary: RemainingSummary) {
  const request = vi.fn(async () => summary as unknown)
  const client = { request } as unknown as ApiClient
  return { client, request }
}

describe('runRemaining', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to the current year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    const { client, request } = clientReturning(SUMMARY)

    await runRemaining(client, {})

    expect(request).toHaveBeenCalledWith('/remaining?year=2026')
  })

  it('uses the given year when one is provided', async () => {
    const { client, request } = clientReturning(SUMMARY)

    await runRemaining(client, { year: 2025 })

    expect(request).toHaveBeenCalledWith('/remaining?year=2025')
  })

  it('renders entitled / used / carry-over / remaining lines by default', async () => {
    const { client } = clientReturning(SUMMARY)

    const output = await runRemaining(client, {})

    expect(output).toContain('Entitled')
    expect(output).toContain('Used')
    expect(output).toMatch(/carry/i)
    expect(output).toContain('Remaining')
    expect(output).toContain('18')
  })

  it('prints the raw response as JSON when --json is set', async () => {
    const { client } = clientReturning(SUMMARY)

    const output = await runRemaining(client, { json: true })

    expect(JSON.parse(output)).toEqual(SUMMARY)
  })
})
