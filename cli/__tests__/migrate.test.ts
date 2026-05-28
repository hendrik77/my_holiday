// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../api'
import { UsageError, mapErrorToExit } from '../errors'
import { EXIT } from '../exit-codes'
import { runMigrate } from '../commands/migrate'

const CSV = ['Start Date;End Date;Note;Type', '2026-07-01;2026-07-05;Sommer;urlaub'].join('\n')

function clientReturning(response: unknown) {
  const request = vi.fn(async () => response)
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

describe('runMigrate', () => {
  const dirs: string[] = []
  function tmpCsv(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'mh-migrate-'))
    dirs.push(dir)
    const file = join(dir, 'import.csv')
    writeFileSync(file, content, 'utf8')
    return file
  }
  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  it('reads the CSV file and POSTs its body to /import', async () => {
    const file = tmpCsv(CSV)
    const { client, request } = clientReturning({ imported: 1, skipped: [], errors: [] })

    await runMigrate(client, { file })

    expect(request).toHaveBeenCalledWith('/import', expect.objectContaining({ method: 'POST' }))
    const init = (request.mock.calls as unknown as Array<[string, RequestInit]>)[0][1]
    expect(init.body).toBe(CSV)
    expect(new Headers(init.headers).get('Content-Type')).toBe('text/csv')
  })

  it('returns a summary and exits 0 on a fully successful import', async () => {
    const file = tmpCsv(CSV)
    const { client } = clientReturning({ imported: 2, skipped: [], errors: [] })

    const output = await runMigrate(client, { file })

    expect(output).toContain('Imported 2')
    expect(output).toContain('skipped 0')
    expect(output).toContain('errored 0')
  })

  it('throws a usage error (exit 1) on a partial import, with the summary in the message', async () => {
    const file = tmpCsv(CSV)
    const { client } = clientReturning({
      imported: 1,
      skipped: [{ startDate: '2026-07-03', endDate: '2026-07-07', reason: 'overlap' }],
      errors: [],
    })

    const err = await rejection(runMigrate(client, { file }))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect((err as UsageError).message).toContain('overlap')
  })

  it('parses locally and never calls the API with --dry-run', async () => {
    const file = tmpCsv(CSV)
    const { client, request } = clientReturning({ imported: 0, skipped: [], errors: [] })

    const output = await runMigrate(client, { file, dryRun: true })

    expect(request).not.toHaveBeenCalled()
    expect(output).toMatch(/dry run/i)
    expect(output).toContain('1')
  })

  it('rejects with exit 1 when no file path is given', async () => {
    const { client, request } = clientReturning({ imported: 0, skipped: [], errors: [] })

    const err = await rejection(runMigrate(client, {}))

    expect(err).toBeInstanceOf(UsageError)
    expect(mapErrorToExit(err).code).toBe(EXIT.USAGE)
    expect(request).not.toHaveBeenCalled()
  })
})
