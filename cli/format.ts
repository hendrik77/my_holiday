import type { QuotaWarning, VacationPeriod } from '../src/types'

/** A period as returned by `GET /periods`, optionally carrying server-computed work days. */
export interface ListedPeriod extends VacationPeriod {
  readonly workDays?: number
}

/** A period as returned by a write (POST/PUT), optionally carrying quota warnings. */
export interface WrittenPeriod extends VacationPeriod {
  readonly warnings?: readonly QuotaWarning[]
}

const MS_PER_DAY = 86_400_000
const HEADERS = ['ID', 'Start', 'End', 'Days', 'Type', 'Note'] as const

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

/** Render vacation periods as a fixed-width `ID | Start | End | Days | Type | Note` table. */
export function formatPeriodsTable(periods: ListedPeriod[]): string {
  if (periods.length === 0) {
    return 'No vacation periods.'
  }
  const rows = periods.map((period) => [
    period.id.slice(0, 7),
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

/** Compact vacation status for the `today` command. */
export interface StatusInfo {
  readonly year: number
  readonly remaining: number
  /** Period covering today, if the user is currently on vacation. */
  readonly active: ListedPeriod | null
  /** Earliest period starting after today, if any. */
  readonly next: ListedPeriod | null
  /** Whole days from today until `next` starts (null when there is no next). */
  readonly daysUntilNext: number | null
}

/** Render a one-line vacation status (remaining days + active/next period). */
export function formatStatus(info: StatusInfo): string {
  const left = `${formatDays(info.remaining)} days left`
  if (info.active) {
    return `${left} · on vacation until ${info.active.endDate}`
  }
  if (info.next) {
    const type = info.next.type ?? 'urlaub'
    const days = info.daysUntilNext ?? 0
    const unit = days === 1 ? 'day' : 'days'
    return `${left} · next: ${type} in ${days} ${unit} (${info.next.startDate}→${info.next.endDate})`
  }
  return `${left} · no upcoming vacation`
}

/**
 * Render quota-exceeded warnings as one `⚠` line per affected year, or an empty
 * string when there are none. Meant for stderr so stdout stays script-stable.
 */
export function formatQuotaWarnings(warnings: readonly QuotaWarning[] = []): string {
  return warnings
    .map(
      (w) =>
        `⚠ ${w.year}: booked ${formatDays(w.usedDays)} of ${formatDays(w.entitledDays)} Urlaub days — over by ${formatDays(-w.remaining)}`,
    )
    .join('\n')
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
