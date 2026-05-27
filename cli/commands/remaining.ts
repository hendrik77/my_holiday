import type { ApiClient } from '../api'
import { type RemainingSummary, formatRemaining } from '../format'

export interface RemainingOptions {
  readonly year?: number
  readonly json?: boolean
}

/**
 * Fetch the server-computed remaining-entitlement summary for a year (defaulting
 * to the current year) and return the string to print. Entitlement math lives on
 * the server (ADR 0002); this command only requests and renders it.
 */
export async function runRemaining(
  client: ApiClient,
  options: RemainingOptions = {},
): Promise<string> {
  const year = options.year ?? new Date().getFullYear()
  const summary = await client.request<RemainingSummary>(`/remaining?year=${year}`)
  return options.json ? JSON.stringify(summary, null, 2) : formatRemaining(summary)
}
