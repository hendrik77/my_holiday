import { readFile } from 'node:fs/promises'
import { ApiError, type ApiClient } from '../api'
import { parseImportCSV } from '../../src/utils/csv'
import { UsageError } from '../errors'

interface ImportResponse {
  readonly imported: number
  readonly skipped: ReadonlyArray<{ startDate: string; endDate: string; reason: string }>
  readonly errors: readonly string[]
}

export interface MigrateOptions {
  readonly file?: string
  readonly dryRun?: boolean
  readonly json?: boolean
}

/** Outcome of a migrate run: the text to print, and whether everything imported cleanly. */
export interface MigrateResult {
  readonly output: string
  readonly ok: boolean
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Import vacation periods from a CSV file. Reads the file and POSTs it to
 * `/import`, returning the text to print plus `ok` (false when anything was
 * skipped or errored, or the server rejected the whole file) so the caller can
 * print the result to stdout and still exit non-zero. `--dry-run` parses locally
 * via `parseImportCSV` and never contacts the server. Only a missing file path
 * throws (a true usage error); network/5xx propagate as `ApiError`.
 */
export async function runMigrate(client: ApiClient, options: MigrateOptions = {}): Promise<MigrateResult> {
  const { file } = options
  if (!file) {
    throw new UsageError('a CSV file path is required: my-holiday migrate <file>')
  }

  const csv = await readFile(file, 'utf8')

  if (options.dryRun) {
    const { periods, errors } = parseImportCSV(csv)
    const output = options.json
      ? JSON.stringify({ dryRun: true, wouldImport: periods.length, errors }, null, 2)
      : `Dry run: ${periods.length} period(s) would import, ${errors.length} error(s); nothing sent.`
    return { output, ok: true }
  }

  let result: ImportResponse
  try {
    result = await client.request<ImportResponse>('/import', {
      method: 'POST',
      body: csv,
      headers: { 'Content-Type': 'text/csv' },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 400) {
      const output = options.json
        ? JSON.stringify(parseJsonOrNull(err.body) ?? { imported: 0, skipped: [], errors: [] }, null, 2)
        : 'No rows could be imported from the CSV.'
      return { output, ok: false }
    }
    throw err
  }

  const reasons = [...new Set(result.skipped.map((s) => s.reason))].join(', ')
  const summary =
    `Imported ${result.imported}, ` +
    `skipped ${result.skipped.length}${result.skipped.length ? ` (${reasons})` : ''}, ` +
    `errored ${result.errors.length}${result.errors.length ? ` (${result.errors.join('; ')})` : ''}`
  const ok = result.skipped.length === 0 && result.errors.length === 0
  const output = options.json ? JSON.stringify(result, null, 2) : summary
  return { output, ok }
}
