import type { ApiClient } from '../api'
import { type ListedPeriod, formatPeriodsTable } from '../format'

export interface ListOptions {
  readonly year?: number
  readonly json?: boolean
}

/**
 * Fetch vacation periods and render them. Returns the string to print so the
 * caller owns stdout (and the result stays unit-testable without spying).
 */
export async function runList(client: ApiClient, options: ListOptions = {}): Promise<string> {
  const path = options.year ? `/periods?year=${options.year}` : '/periods'
  const periods = await client.request<ListedPeriod[]>(path)
  return options.json ? JSON.stringify(periods, null, 2) : formatPeriodsTable(periods)
}
