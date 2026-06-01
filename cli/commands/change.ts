import { ApiError, type ApiClient } from '../api'
import { type VacationType, VACATION_TYPES } from '../../src/types'
import { UsageError } from '../errors'
import type { ListedPeriod } from '../format'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ChangeOptions {
  /** Full period id or a unique prefix (from `holiday list`). */
  readonly id?: string
  readonly start?: string
  readonly end?: string
  readonly type?: string
  readonly note?: string
  readonly halfDay?: boolean
  readonly json?: boolean
}

interface PeriodUpdate {
  startDate?: string
  endDate?: string
  type?: string
  note?: string
  halfDay?: boolean
}

/**
 * Update an existing vacation period. Validates input locally, resolves the
 * given id (or unique prefix) against `GET /periods`, then sends a partial
 * `PUT /periods/:id` carrying only the fields the user provided. Bad input and
 * server 400/404/409 surface as `UsageError` (exit 1).
 */
export async function runChange(client: ApiClient, options: ChangeOptions = {}): Promise<string> {
  const { id, start, end, type, note, halfDay } = options

  if (!id) {
    throw new UsageError('an id (or unique prefix) is required: holiday change <id> ...')
  }
  if (start !== undefined && !ISO_DATE_RE.test(start)) {
    throw new UsageError('--start must be an ISO date (YYYY-MM-DD)')
  }
  if (end !== undefined && !ISO_DATE_RE.test(end)) {
    throw new UsageError('--end must be an ISO date (YYYY-MM-DD)')
  }
  if (type !== undefined && !VACATION_TYPES.includes(type as VacationType)) {
    throw new UsageError(`--type must be one of: ${VACATION_TYPES.join(', ')}`)
  }

  const updates: PeriodUpdate = {}
  if (start !== undefined) updates.startDate = start
  if (end !== undefined) updates.endDate = end
  if (type !== undefined) updates.type = type
  if (note !== undefined) updates.note = note
  if (halfDay !== undefined) updates.halfDay = halfDay

  if (Object.keys(updates).length === 0) {
    throw new UsageError('specify at least one field to change (--start, --end, --type, --note, --half-day)')
  }

  // Resolve the id prefix against the live period list (the CLI is HTTP-only).
  const periods = await client.request<ListedPeriod[]>('/periods')
  const matches = periods.filter((p) => p.id.startsWith(id))
  if (matches.length === 0) {
    throw new UsageError(`no period matches id '${id}'`)
  }
  if (matches.length > 1) {
    throw new UsageError(`id '${id}' is ambiguous (${matches.length} matches) — use more characters`)
  }
  const fullId = matches[0].id

  let updated: ListedPeriod
  try {
    updated = await client.request<ListedPeriod>(`/periods/${fullId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new UsageError(`overlap: ${err.body || 'period overlaps an existing one'}`)
    }
    if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
      throw new UsageError(`invalid request: ${err.body || 'update failed'}`)
    }
    throw err
  }

  if (options.json) {
    return JSON.stringify(updated, null, 2)
  }
  return `Updated: ${updated.id} ${updated.startDate} → ${updated.endDate} (${updated.type ?? 'urlaub'})`
}
