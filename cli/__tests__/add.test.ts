// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type ApiClient } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'
import { runAdd } from '../commands/add'

const CREATED = {
  id: 'p-123',
  startDate: '2026-07-01',
  endDate: '2026-07-15',
  note: 'Sommerurlaub',
  halfDay: false,
  type: 'urlaub',
  changedAt: '2026-05-27T00:00:00.000Z',
}

const VALID = { start: '2026-07-01', end: '2026-07-15', type: 'urlaub', note: 'Sommerurlaub' }

function resolvingClient(value: unknown) {
  const request = vi.fn(async () => value)
  return { client: { request } as unknown as ApiClient, request }
}

function rejectingClient(error: unknown) {
  const request = vi.fn(async () => {
    throw error
  })
  return { client: { request } as unknown as ApiClient, request }
}

/** Resolve to the rejection reason, or fail loudly if the promise resolved. */
function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject, but it resolved')
    },
    (err: unknown) => err,
  )
}

describe('runAdd', () => {
  it('rejects a malformed --start with exit 1 and makes no request', async () => {
    const { client, request } = resolvingClient(CREATED)

    const err = await rejection(runAdd(client, { ...VALID, start: '07/01/2026' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects an unknown --type with exit 1 and makes no request', async () => {
    const { client, request } = resolvingClient(CREATED)

    const err = await rejection(runAdd(client, { ...VALID, type: 'nonsense' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(request).not.toHaveBeenCalled()
  })

  it('POSTs the correct body and prints an "Added:" line on success', async () => {
    const { client, request } = resolvingClient(CREATED)

    const output = await runAdd(client, VALID)

    expect(request).toHaveBeenCalledWith('/periods', expect.objectContaining({ method: 'POST' }))
    const calls = request.mock.calls as unknown as Array<[string, RequestInit]>
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      note: 'Sommerurlaub',
      halfDay: false,
      type: 'urlaub',
    })
    expect(output).toContain('Added:')
    expect(output).toContain('p-123')
  })

  it('maps a server 409 to an overlap usage error (exit 1)', async () => {
    const { client } = rejectingClient(new ApiError(409, 'overlaps existing period', 'failed'))

    const err = await rejection(runAdd(client, VALID))

    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toMatch(/overlap/i)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
  })

  it('maps a server 400 to a validation usage error (exit 1)', async () => {
    const { client } = rejectingClient(new ApiError(400, 'bad dates', 'failed'))

    const err = await rejection(runAdd(client, VALID))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
  })

  it('defaults endDate to startDate when --end is omitted (single day)', async () => {
    const { client, request } = resolvingClient(CREATED)

    await runAdd(client, { start: '2026-10-14', type: 'urlaub' })

    const calls = request.mock.calls as unknown as Array<[string, RequestInit]>
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      startDate: '2026-10-14',
      endDate: '2026-10-14',
      note: '',
      halfDay: false,
      type: 'urlaub',
    })
  })

  it('supports a single half-day from just --start', async () => {
    const { client, request } = resolvingClient(CREATED)

    await runAdd(client, { start: '2026-10-14', halfDay: true })

    const calls = request.mock.calls as unknown as Array<[string, RequestInit]>
    const body = JSON.parse(calls[0][1].body as string)
    expect(body.startDate).toBe('2026-10-14')
    expect(body.endDate).toBe('2026-10-14')
    expect(body.halfDay).toBe(true)
  })

  it('rejects a malformed --end (when provided) with exit 1 and makes no request', async () => {
    const { client, request } = resolvingClient(CREATED)

    const err = await rejection(runAdd(client, { start: '2026-10-14', end: '10/14/2026' }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(request).not.toHaveBeenCalled()
  })

  it('prints the created record verbatim when --json is set', async () => {
    const { client } = resolvingClient(CREATED)

    const output = await runAdd(client, { ...VALID, json: true })

    expect(JSON.parse(output)).toEqual(CREATED)
  })
})
