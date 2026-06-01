// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiClient } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'
import { runChange } from '../commands/change'

const PERIODS = [
  { id: 'aaaa111ffff', startDate: '2026-07-01', endDate: '2026-07-15', note: 'Sommer', halfDay: false, type: 'urlaub' },
  { id: 'bbbb222ffff', startDate: '2026-09-01', endDate: '2026-09-03', note: '', halfDay: false, type: 'urlaub' },
]

function clientReturning(periods: unknown[] = PERIODS, updated: unknown = { ...PERIODS[0], note: 'updated' }) {
  const request = vi.fn(async (_path: string, init?: RequestInit) =>
    (init?.method === 'PUT' ? updated : periods) as unknown,
  )
  return { client: { request } as unknown as ApiClient, request }
}

function clientPutRejects(error: unknown) {
  const request = vi.fn(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') throw error
    return PERIODS as unknown
  })
  return { client: { request } as unknown as ApiClient, request }
}

function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject, but it resolved')
    },
    (err: unknown) => err,
  )
}

/** Return the parsed body of the PUT call, asserting exactly one PUT happened. */
function putCall(request: ReturnType<typeof vi.fn>): { path: string; body: Record<string, unknown> } {
  const calls = request.mock.calls as unknown as Array<[string, RequestInit | undefined]>
  const put = calls.find(([, init]) => init?.method === 'PUT')
  if (!put) throw new Error('no PUT request was made')
  return { path: put[0], body: JSON.parse(put[1]!.body as string) }
}

describe('runChange', () => {
  it('resolves a full id and PUTs only the provided fields', async () => {
    const { client, request } = clientReturning()

    await runChange(client, { id: 'aaaa111ffff', note: 'Sommerurlaub' })

    expect(request).toHaveBeenCalledWith('/periods')
    const { path, body } = putCall(request)
    expect(path).toBe('/periods/aaaa111ffff')
    expect(body).toEqual({ note: 'Sommerurlaub' })
  })

  it('resolves a short unique id prefix', async () => {
    const { client, request } = clientReturning()

    await runChange(client, { id: 'aaaa', type: 'kur' })

    expect(putCall(request).path).toBe('/periods/aaaa111ffff')
    expect(putCall(request).body).toEqual({ type: 'kur' })
  })

  it('rejects an ambiguous prefix without a PUT', async () => {
    const periods = [
      { id: 'abc1', startDate: '2026-07-01', endDate: '2026-07-02', note: '', type: 'urlaub' },
      { id: 'abc2', startDate: '2026-08-01', endDate: '2026-08-02', note: '', type: 'urlaub' },
    ]
    const { client, request } = clientReturning(periods)

    const err = await rejection(runChange(client, { id: 'abc', note: 'x' }))

    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toMatch(/ambiguous/i)
    expect(request.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false)
  })

  it('rejects an unknown id without a PUT', async () => {
    const { client, request } = clientReturning()

    const err = await rejection(runChange(client, { id: 'zzzz', note: 'x' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(request.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false)
  })

  it('rejects when no fields are given (makes no request)', async () => {
    const { client, request } = clientReturning()

    const err = await rejection(runChange(client, { id: 'aaaa111ffff' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(request).not.toHaveBeenCalled()
  })

  it('sends halfDay:false for --no-half-day and true for --half-day', async () => {
    const off = clientReturning()
    await runChange(off.client, { id: 'aaaa', halfDay: false })
    expect(putCall(off.request).body).toEqual({ halfDay: false })

    const on = clientReturning()
    await runChange(on.client, { id: 'aaaa', halfDay: true })
    expect(putCall(on.request).body).toEqual({ halfDay: true })
  })

  it('rejects a malformed --start before any request', async () => {
    const { client, request } = clientReturning()

    const err = await rejection(runChange(client, { id: 'aaaa', start: '01.07.2026' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(request).not.toHaveBeenCalled()
  })

  it('maps a server 409 to an overlap usage error', async () => {
    const { client } = clientPutRejects(new ApiError(409, 'overlaps existing period', 'failed'))

    const err = await rejection(runChange(client, { id: 'aaaa', end: '2026-09-05' }))

    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toMatch(/overlap/i)
  })

  it('maps a server 400 to a usage error (exit 1)', async () => {
    const { client } = clientPutRejects(new ApiError(400, 'bad dates', 'failed'))

    const err = await rejection(runChange(client, { id: 'aaaa', start: '2026-13-01' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
  })

  it('maps a server 404 (period vanished between resolve and update) to a usage error', async () => {
    const { client } = clientPutRejects(new ApiError(404, 'Period not found', 'failed'))

    const err = await rejection(runChange(client, { id: 'aaaa', note: 'x' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
  })

  it('rethrows a non-usage server error (e.g. 500) as-is (exit 2)', async () => {
    const { client } = clientPutRejects(new ApiError(500, 'boom', 'failed'))

    const err = await rejection(runChange(client, { id: 'aaaa', note: 'x' }))

    expect(err).toBeInstanceOf(ApiError)
    expect(mapErrorToExit(err).code).toBe(EXIT.SERVER)
  })

  it('returns the updated record as JSON with --json', async () => {
    const updated = { ...PERIODS[0], note: 'Sommerurlaub' }
    const { client } = clientReturning(PERIODS, updated)

    const output = await runChange(client, { id: 'aaaa', note: 'Sommerurlaub', json: true })

    expect(JSON.parse(output)).toEqual(updated)
  })
})
