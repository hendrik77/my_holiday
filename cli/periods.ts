import type { ApiClient } from './api'
import { UsageError } from './errors'
import type { ListedPeriod } from './format'

/**
 * Resolve an id or unique id prefix (git-style, e.g. the short ID shown by
 * `holiday list`) to a single period by matching against `GET /periods`. Throws
 * a `UsageError` when nothing matches or the prefix is ambiguous. Shared by the
 * `change` and `delete` commands (the CLI is HTTP-only, so resolution happens
 * client-side against the live list).
 */
export async function resolvePeriod(client: ApiClient, idPrefix: string): Promise<ListedPeriod> {
  const periods = await client.request<ListedPeriod[]>('/periods')
  const matches = periods.filter((p) => p.id.startsWith(idPrefix))
  if (matches.length === 0) {
    throw new UsageError(`no period matches id '${idPrefix}'`)
  }
  if (matches.length > 1) {
    throw new UsageError(`id '${idPrefix}' is ambiguous (${matches.length} matches) — use more characters`)
  }
  return matches[0]
}
