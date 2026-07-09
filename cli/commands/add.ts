import { ApiError, type ApiClient } from '../api'
import { type VacationType, VACATION_TYPES } from '../../src/types'
import { UsageError } from '../errors'
import { formatQuotaWarnings, type WrittenPeriod } from '../format'
import type { CommandResult } from './result'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface AddOptions {
  readonly start?: string
  readonly end?: string
  readonly type?: string
  readonly note?: string
  readonly halfDay?: boolean
  readonly json?: boolean
}

/**
 * Validate input locally, POST a new vacation period, and return the line to
 * print (plus any quota warning for stderr). Bad input throws `UsageError`
 * (exit 1) before any request is made; server 400/409 are translated to
 * `UsageError` so the user sees a usage-level failure rather than a generic
 * server error (exit 2).
 */
export async function runAdd(client: ApiClient, options: AddOptions = {}): Promise<CommandResult> {
  const { start, type } = options

  if (!start || !ISO_DATE_RE.test(start)) {
    throw new UsageError('--start is required and must be an ISO date (YYYY-MM-DD)')
  }
  // --end is optional: a single-day (or half-day) vacation just needs --start.
  const end = options.end ?? start
  if (!ISO_DATE_RE.test(end)) {
    throw new UsageError('--end must be an ISO date (YYYY-MM-DD)')
  }
  if (type !== undefined && !VACATION_TYPES.includes(type as VacationType)) {
    throw new UsageError(`--type must be one of: ${VACATION_TYPES.join(', ')}`)
  }

  const body = {
    startDate: start,
    endDate: end,
    note: options.note ?? '',
    halfDay: options.halfDay === true,
    type: type ?? 'urlaub',
  }

  let created: WrittenPeriod
  try {
    created = await client.request<WrittenPeriod>('/periods', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new UsageError(`overlap: ${err.body || 'period overlaps an existing one'}`)
    }
    if (err instanceof ApiError && err.status === 400) {
      throw new UsageError(`invalid request: ${err.body || 'validation failed'}`)
    }
    throw err
  }

  if (options.json) {
    return { output: JSON.stringify(created, null, 2) }
  }
  const output = `Added: ${created.id} ${created.startDate} → ${created.endDate} (${created.type ?? 'urlaub'})`
  const warning = formatQuotaWarnings(created.warnings)
  return warning ? { output, warning } : { output }
}
