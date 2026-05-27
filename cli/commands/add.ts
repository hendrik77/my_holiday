import { ApiError, type ApiClient } from '../api'
import { type VacationPeriod, type VacationType, VACATION_TYPES } from '../../src/types'
import { UsageError } from '../errors'

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
 * print. Bad input throws `UsageError` (exit 1) before any request is made;
 * server 400/409 are translated to `UsageError` so the user sees a usage-level
 * failure rather than a generic server error (exit 2).
 */
export async function runAdd(client: ApiClient, options: AddOptions = {}): Promise<string> {
  const { start, end, type } = options

  if (!start || !ISO_DATE_RE.test(start)) {
    throw new UsageError('--start is required and must be an ISO date (YYYY-MM-DD)')
  }
  if (!end || !ISO_DATE_RE.test(end)) {
    throw new UsageError('--end is required and must be an ISO date (YYYY-MM-DD)')
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

  let created: VacationPeriod
  try {
    created = await client.request<VacationPeriod>('/periods', {
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
    return JSON.stringify(created, null, 2)
  }
  return `Added: ${created.id} ${created.startDate} → ${created.endDate} (${created.type ?? 'urlaub'})`
}
