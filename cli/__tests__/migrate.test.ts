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

  it('reports ok and a summary on a fully successful import', async () => {
    const file = tmpCsv(CSV)
    const { client } = clientReturning({ imported: 2, skipped: [], errors: [] })

    const { output, ok } = await runMigrate(client, { file })

    expect(ok).toBe(true)
    expect(output).toContain('Imported 2')
    expect(output).toContain('skipped 0')
    expect(output).toContain('errored 0')
  })

  it('reports not-ok with the summary on a partial import (drives exit 1)', async () => {
    const file = tmpCsv(CSV)
    const { client } = clientReturning({
      imported: 1,
      skipped: [{ startDate: '2026-07-03', endDate: '2026-07-07', reason: 'overlap' }],
      errors: [],
    })

    const { output, ok } = await runMigrate(client, { file })

    expect(ok).toBe(false)
    expect(output).toContain('overlap')
  })

  it('parses locally and never calls the API with --dry-run', async () => {
    const file = tmpCsv(CSV)
    const { client, request } = clientReturning({ imported: 0, skipped: [], errors: [] })

    const { output, ok } = await runMigrate(client, { file, dryRun: true })

    expect(request).not.toHaveBeenCalled()
    expect(ok).toBe(true)
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

  it('emits the structured import result as JSON with --json on success', async () => {
    const file = tmpCsv(CSV)
    const { client } = clientReturning({ imported: 2, skipped: [], errors: [] })

    const { output, ok } = await runMigrate(client, { file, json: true })

    expect(ok).toBe(true)
    expect(JSON.parse(output)).toEqual({ imported: 2, skipped: [], errors: [] })
  })

  it('emits the structured result (not-ok) on a partial import with --json', async () => {
    const file = tmpCsv(CSV)
    const response = {
      imported: 1,
      skipped: [{ startDate: '2026-07-03', endDate: '2026-07-07', reason: 'overlap' }],
      errors: [],
    }
    const { client } = clientReturning(response)

    const { output, ok } = await runMigrate(client, { file, json: true })

    expect(ok).toBe(false)
    expect(JSON.parse(output)).toEqual(response)
  })

  it('emits structured JSON for --dry-run --json without calling the API', async () => {
    const file = tmpCsv(CSV)
    const { client, request } = clientReturning({ imported: 0, skipped: [], errors: [] })

    const { output, ok } = await runMigrate(client, { file, dryRun: true, json: true })

    expect(request).not.toHaveBeenCalled()
    expect(ok).toBe(true)
    expect(JSON.parse(output)).toEqual({ dryRun: true, wouldImport: 1, errors: [] })
  })
})
