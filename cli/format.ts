import type { VacationPeriod } from '../src/types'

/** A period as returned by `GET /periods`, optionally carrying server-computed work days. */
export interface ListedPeriod extends VacationPeriod {
  readonly workDays?: number
}

const MS_PER_DAY = 86_400_000
const HEADERS = ['Start', 'End', 'Days', 'Type', 'Note'] as const

/**
 * Inclusive day span of a period. A half-day (single-day period flagged
 * `halfDay`) counts as 0.5; otherwise it is the calendar-day count from start
 * to end inclusive. Working-day / holiday math is deliberately a server concern
 * (see ADR 0002) — `list` renders only what `/periods` returns.
 */
function periodDays(period: VacationPeriod): number {
  if (period.halfDay && period.startDate === period.endDate) {
    return 0.5
  }
  const start = Date.parse(`${period.startDate}T00:00:00Z`)
  const end = Date.parse(`${period.endDate}T00:00:00Z`)
  return Math.round((end - start) / MS_PER_DAY) + 1
}

function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1)
}

function renderTable(headers: readonly string[], rows: readonly string[][]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length)),
  )
  const renderRow = (cells: readonly string[]): string =>
    cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd()
  return [renderRow(headers), ...rows.map(renderRow)].join('\n')
}

/** Render vacation periods as a fixed-width `Start | End | Days | Type | Note` table. */
export function formatPeriodsTable(periods: ListedPeriod[]): string {
  if (periods.length === 0) {
    return 'No vacation periods.'
  }
  const rows = periods.map((period) => [
    period.startDate,
    period.endDate,
    formatDays(period.workDays ?? periodDays(period)),
    period.type ?? 'urlaub',
    period.note || '',
  ])
  return renderTable(HEADERS, rows)
}

export interface CarryOver {
  readonly available: number
  readonly used: number
  readonly expiresOn: string
}

/** Server-computed remaining-entitlement summary returned by `GET /remaining`. */
export interface RemainingSummary {
  readonly year: number
  readonly totalDays: number
  readonly entitledDays: number
  readonly usedDays: number
  readonly carryOver: CarryOver
  readonly remaining: number
}

/** Render a remaining-entitlement summary as aligned human-readable lines. */
export function formatRemaining(summary: RemainingSummary): string {
  const { carryOver } = summary
  return [
    `Year:       ${summary.year}`,
    `Entitled:   ${formatDays(summary.entitledDays)} of ${formatDays(summary.totalDays)}`,
    `Used:       ${formatDays(summary.usedDays)}`,
    `Carry-over: ${formatDays(carryOver.available)} (used ${formatDays(carryOver.used)}, expires ${carryOver.expiresOn})`,
    `Remaining:  ${formatDays(summary.remaining)}`,
  ].join('\n')
}
