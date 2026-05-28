// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import type { VacationPeriod } from '../../src/types'
import { runList } from '../commands/list'

function clientReturning(periods: Array<VacationPeriod & { workDays?: number }>) {
  const request = vi.fn(async () => periods as unknown)
  const client = { request } as unknown as ApiClient
  return { client, request }
}

const SAMPLE: VacationPeriod[] = [
  { id: '1', startDate: '2026-07-01', endDate: '2026-07-05', note: 'Sommerurlaub', type: 'urlaub' },
]

describe('runList', () => {
  it('requests /periods when no year is given', async () => {
    const { client, request } = clientReturning([])

    await runList(client, {})

    expect(request).toHaveBeenCalledWith('/periods')
  })

  it('requests /periods?year=YYYY when a year is given', async () => {
    const { client, request } = clientReturning([])

    await runList(client, { year: 2026 })

    expect(request).toHaveBeenCalledWith('/periods?year=2026')
  })

  it('renders a table with Start | End | Days | Type | Note by default', async () => {
    const { client } = clientReturning(SAMPLE)

    const output = await runList(client, {})

    for (const header of ['Start', 'End', 'Days', 'Type', 'Note']) {
      expect(output).toContain(header)
    }
    expect(output).toContain('2026-07-01')
    expect(output).toContain('Sommerurlaub')
  })

  it('prints the raw API array as JSON when --json is set', async () => {
    const { client } = clientReturning(SAMPLE)

    const output = await runList(client, { json: true })

    expect(JSON.parse(output)).toEqual(SAMPLE)
  })

  it('renders the server-provided workDays in the Days column', async () => {
    const { client } = clientReturning([
      { id: '1', startDate: '2026-07-01', endDate: '2026-07-05', note: 'Sommerurlaub', type: 'urlaub', workDays: 3 },
    ])

    const output = await runList(client, {})

    const cells = output.split('\n')[1].split(/\s{2,}/)
    expect(cells[2]).toBe('3')
  })

  it('falls back to the calendar-day span when workDays is absent', async () => {
    const { client } = clientReturning(SAMPLE)

    const output = await runList(client, {})

    const cells = output.split('\n')[1].split(/\s{2,}/)
    expect(cells[2]).toBe('5')
  })
})
