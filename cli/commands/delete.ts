import { ApiError, type ApiClient } from '../api'
import { UsageError } from '../errors'
import { resolvePeriod } from '../periods'

export interface DeleteOptions {
  /** Full period id or a unique prefix (from `holiday list`). */
  readonly id?: string
  readonly json?: boolean
}

/**
 * Delete a vacation period. Resolves the given id (or unique prefix) against
 * `GET /periods`, then `DELETE /periods/:id`. Non-interactive by design (no
 * confirmation) — the explicit, resolved id is the guard. A 404 (period removed
 * between resolve and delete) surfaces as `UsageError` (exit 1).
 */
export async function runDelete(client: ApiClient, options: DeleteOptions = {}): Promise<string> {
  const { id } = options
  if (!id) {
    throw new UsageError('an id (or unique prefix) is required: holiday delete <id>')
  }

  const period = await resolvePeriod(client, id)

  try {
    // 204 No Content — no body to parse; the resolved record drives the output.
    await client.request(`/periods/${period.id}`, { method: 'DELETE' })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new UsageError(`no period with id '${period.id}'`)
    }
    throw err
  }

  if (options.json) {
    return JSON.stringify({ deleted: true, ...period }, null, 2)
  }
  return `Deleted: ${period.id} ${period.startDate} → ${period.endDate} (${period.type ?? 'urlaub'})`
}
