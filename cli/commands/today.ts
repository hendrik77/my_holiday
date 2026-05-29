import type { ApiClient } from '../api'
import { daysBetween, todayISO } from '../dates'
import { type ListedPeriod, type RemainingSummary, type StatusInfo, formatStatus } from '../format'

export interface TodayOptions {
  readonly json?: boolean
}

/**
 * Fetch the current-year remaining summary plus all periods and render a compact
 * one-line status: remaining days, the active period (if on vacation today), or
 * the next upcoming one. Periods are fetched unfiltered so a vacation early next
 * year still counts as "next".
 */
export async function runToday(client: ApiClient, options: TodayOptions = {}): Promise<string> {
  const today = todayISO()
  const year = Number(today.slice(0, 4))

  const [summary, periods] = await Promise.all([
    client.request<RemainingSummary>(`/remaining?year=${year}`),
    client.request<ListedPeriod[]>('/periods'),
  ])

  const active = periods.find((p) => p.startDate <= today && today <= p.endDate) ?? null
  const next =
    periods
      .filter((p) => p.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  const daysUntilNext = next ? daysBetween(today, next.startDate) : null

  const info: StatusInfo = { year, remaining: summary.remaining, active, next, daysUntilNext }
  return options.json ? JSON.stringify(info, null, 2) : formatStatus(info)
}
