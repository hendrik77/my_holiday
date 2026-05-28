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

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Import vacation periods from a CSV file. Reads the file and POSTs it to
 * `/import`; a partial result (anything skipped or errored) throws a
 * `UsageError` (exit 1) with the summary as its message. `--dry-run` parses the
 * file locally via `parseImportCSV` and never contacts the server.
 */
export async function runMigrate(client: ApiClient, options: MigrateOptions = {}): Promise<string> {
  const { file } = options
  if (!file) {
    throw new UsageError('a CSV file path is required: my-holiday migrate <file>')
  }

  const csv = await readFile(file, 'utf8')

  if (options.dryRun) {
    const { periods, errors } = parseImportCSV(csv)
    if (options.json) {
      return JSON.stringify({ dryRun: true, wouldImport: periods.length, errors }, null, 2)
    }
    return `Dry run: ${periods.length} period(s) would import, ${errors.length} error(s); nothing sent.`
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
      const message = `No rows could be imported: ${err.body || 'nothing parseable in the CSV'}`
      throw new UsageError(
        message,
        options.json ? (parseJsonOrNull(err.body) ?? { imported: 0, skipped: [], errors: [] }) : undefined,
      )
    }
    throw err
  }

  const reasons = [...new Set(result.skipped.map((s) => s.reason))].join(', ')
  const summary =
    `Imported ${result.imported}, ` +
    `skipped ${result.skipped.length}${result.skipped.length ? ` (${reasons})` : ''}, ` +
    `errored ${result.errors.length}${result.errors.length ? ` (${result.errors.join('; ')})` : ''}`
  const partial = result.skipped.length > 0 || result.errors.length > 0

  if (partial) {
    throw new UsageError(summary, options.json ? result : undefined)
  }
  return options.json ? JSON.stringify(result, null, 2) : summary
}
