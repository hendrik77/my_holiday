import type { ApiClient } from '../api'
import { type DayKind, type DayLookup, STATE_NAMES, renderCalendar } from '../calendar-view'
import { todayISO } from '../dates'
import { UsageError } from '../errors'
import type { ListedPeriod } from '../format'

interface Holiday {
  readonly date: string
  readonly name: string
}

export interface CalendarOptions {
  readonly year?: number
  readonly month?: number
  readonly color?: boolean
}

const MS_PER_DAY = 86_400_000

/** Yield each ISO date from start to end inclusive (UTC). */
function* eachDay(startISO: string, endISO: string): Generator<string> {
  let t = Date.parse(`${startISO}T00:00:00Z`)
  const end = Date.parse(`${endISO}T00:00:00Z`)
  while (t <= end) {
    yield new Date(t).toISOString().slice(0, 10)
    t += MS_PER_DAY
  }
}

function buildLookup(periods: ListedPeriod[], holidays: Set<string>, today: string): DayLookup {
  const vacation = new Map<string, DayKind>()
  for (const p of periods) {
    const kind: DayKind = p.halfDay === true && p.startDate === p.endDate ? 'vacation-half' : 'vacation-full'
    for (const iso of eachDay(p.startDate, p.endDate)) {
      vacation.set(iso, kind)
    }
  }

  return (iso) => {
    let kind = vacation.get(iso)
    if (!kind) {
      if (holidays.has(iso)) {
        kind = 'holiday'
      } else {
        const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
        kind = dow === 0 || dow === 6 ? 'weekend' : 'normal'
      }
    }
    return { kind, today: iso === today }
  }
}

/**
 * Render a terminal calendar for a year (full-year German grid, or a single
 * month with `--month`). Vacation periods, public holidays (fetched from the
 * server — the CLI never computes them, per ADR-0001/0002) and weekends are
 * shaded; today is emphasised in color mode.
 */
export async function runCalendar(client: ApiClient, options: CalendarOptions = {}): Promise<string> {
  const year = options.year ?? Number(todayISO().slice(0, 4))

  if (options.month !== undefined && (!Number.isInteger(options.month) || options.month < 1 || options.month > 12)) {
    throw new UsageError('--month must be between 1 and 12')
  }

  const [periods, holidays, settings] = await Promise.all([
    client.request<ListedPeriod[]>(`/periods?year=${year}`),
    client.request<Holiday[]>(`/holidays?year=${year}`),
    client.request<{ state: string }>('/settings'),
  ])

  const lookup = buildLookup(periods, new Set(holidays.map((h) => h.date)), todayISO())
  const stateName = STATE_NAMES[settings.state] ?? settings.state

  return renderCalendar({ year, month: options.month, stateName, lookup, color: options.color === true })
}
