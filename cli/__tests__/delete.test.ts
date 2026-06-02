// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiClient } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'
import { runDelete } from '../commands/delete'

const PERIODS = [
  { id: 'aaaa111ffff', startDate: '2026-07-01', endDate: '2026-07-15', note: 'Sommer', halfDay: false, type: 'urlaub' },
  { id: 'bbbb222ffff', startDate: '2026-09-01', endDate: '2026-09-03', note: '', halfDay: false, type: 'urlaub' },
]

function clientReturning(periods: unknown[] = PERIODS) {
  const request = vi.fn(async (_path: string, init?: RequestInit) =>
    (init?.method === 'DELETE' ? undefined : periods) as unknown,
  )
  return { client: { request } as unknown as ApiClient, request }
}

function clientDeleteRejects(error: unknown) {
  const request = vi.fn(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') throw error
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

/** Path of the DELETE call, or undefined if no DELETE was made. */
function deletePath(request: ReturnType<typeof vi.fn>): string | undefined {
  const calls = request.mock.calls as unknown as Array<[string, RequestInit | undefined]>
  return calls.find(([, init]) => init?.method === 'DELETE')?.[0]
}

describe('runDelete', () => {
  it('resolves a full id and DELETEs it', async () => {
    const { client, request } = clientReturning()

    const output = await runDelete(client, { id: 'aaaa111ffff' })

    expect(request).toHaveBeenCalledWith('/periods')
    expect(deletePath(request)).toBe('/periods/aaaa111ffff')
    expect(output).toContain('Deleted:')
    expect(output).toContain('aaaa111ffff')
  })

  it('resolves a short unique prefix', async () => {
    const { client, request } = clientReturning()

    await runDelete(client, { id: 'bbbb' })

    expect(deletePath(request)).toBe('/periods/bbbb222ffff')
  })

  it('rejects an ambiguous prefix without a DELETE', async () => {
    const periods = [
      { id: 'abc1', startDate: '2026-07-01', endDate: '2026-07-02', note: '', type: 'urlaub' },
      { id: 'abc2', startDate: '2026-08-01', endDate: '2026-08-02', note: '', type: 'urlaub' },
    ]
    const { client, request } = clientReturning(periods)

    const err = await rejection(runDelete(client, { id: 'abc' }))

    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toMatch(/ambiguous/i)
    expect(deletePath(request)).toBeUndefined()
  })

  it('rejects an unknown id without a DELETE', async () => {
    const { client, request } = clientReturning()

    const err = await rejection(runDelete(client, { id: 'zzzz' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(deletePath(request)).toBeUndefined()
  })

  it('rejects a missing id and makes no request', async () => {
    const { client, request } = clientReturning()

    const err = await rejection(runDelete(client, {}))

    expect(err).toBeInstanceOf(UsageError)
    expect(request).not.toHaveBeenCalled()
  })

  it('maps a server 404 to a usage error', async () => {
    const { client } = clientDeleteRejects(new ApiError(404, 'Period not found', 'failed'))

    const err = await rejection(runDelete(client, { id: 'aaaa' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
  })

  it('rethrows a non-usage server error (e.g. 500) as-is (exit 2)', async () => {
    const { client } = clientDeleteRejects(new ApiError(500, 'boom', 'failed'))

    const err = await rejection(runDelete(client, { id: 'aaaa' }))

    expect(err).toBeInstanceOf(ApiError)
    expect(mapErrorToExit(err).code).toBe(EXIT.SERVER)
  })

  it('returns a deleted confirmation as JSON with --json', async () => {
    const { client } = clientReturning()

    const parsed = JSON.parse(await runDelete(client, { id: 'aaaa', json: true }))

    expect(parsed.deleted).toBe(true)
    expect(parsed.id).toBe('aaaa111ffff')
  })
})
