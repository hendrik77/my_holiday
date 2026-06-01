import { writeFile } from 'node:fs/promises'
import type { ApiClient } from '../api'
import { UsageError } from '../errors'

const FORMAT_PATHS: Record<string, string> = {
  ics: '/export.ics',
  csv: '/export.csv',
}

export interface ExportOptions {
  readonly format?: string
  readonly year?: number
  readonly out?: string
  readonly bom?: boolean
}

/**
 * Fetch a year's periods as an ICS or CSV export (raw text, not JSON). With
 * `--out` the body is written to that file and a confirmation is returned;
 * otherwise the body itself is returned for the caller to print to stdout.
 */
export async function runExport(client: ApiClient, options: ExportOptions = {}): Promise<string> {
  const { format } = options
  if (!format || !(format in FORMAT_PATHS)) {
    throw new UsageError('--format must be one of: ics, csv')
  }

  const year = options.year ?? new Date().getFullYear()
  const body = await client.requestText(`${FORMAT_PATHS[format]}?year=${year}`)
  // A UTF-8 BOM helps Excel read umlauts in CSV; non-standard for ICS, so csv-only.
  const content = format === 'csv' && options.bom ? `\uFEFF${body}` : body

  if (options.out) {
    await writeFile(options.out, content, 'utf8')
    return `Exported ${format} for ${year} to ${options.out}`
  }
  return content
}
