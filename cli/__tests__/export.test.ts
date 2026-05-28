// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'
import { runExport } from '../commands/export'

const BODY = 'BEGIN:VCALENDAR\nEND:VCALENDAR'

function clientReturning(body: string) {
  const requestText = vi.fn(async () => body)
  const client = { requestText } as unknown as ApiClient
  return { client, requestText }
}

function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject, but it resolved')
    },
    (err: unknown) => err,
  )
}

describe('runExport', () => {
  const tmpDirs: string[] = []
  afterEach(() => {
    for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
    tmpDirs.length = 0
  })

  it('requests /export.ics for --format ics', async () => {
    const { client, requestText } = clientReturning(BODY)

    await runExport(client, { format: 'ics', year: 2026 })

    expect(requestText).toHaveBeenCalledWith('/export.ics?year=2026')
  })

  it('requests /export.csv for --format csv', async () => {
    const { client, requestText } = clientReturning(BODY)

    await runExport(client, { format: 'csv', year: 2026 })

    expect(requestText).toHaveBeenCalledWith('/export.csv?year=2026')
  })

  it('rejects a missing --format with exit 1 and makes no request', async () => {
    const { client, requestText } = clientReturning(BODY)

    const err = await rejection(runExport(client, { year: 2026 }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(requestText).not.toHaveBeenCalled()
  })

  it('returns the body for stdout when no --out is given', async () => {
    const { client } = clientReturning(BODY)

    const output = await runExport(client, { format: 'csv', year: 2026 })

    expect(output).toBe(BODY)
  })

  it('writes the body to the --out file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mh-export-'))
    tmpDirs.push(dir)
    const file = join(dir, 'urlaub.csv')
    const { client } = clientReturning(BODY)

    await runExport(client, { format: 'csv', year: 2026, out: file })

    expect(readFileSync(file, 'utf8')).toBe(BODY)
  })
})
