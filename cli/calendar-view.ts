/**
 * Pure terminal-calendar rendering. No I/O, no holiday computation — callers
 * pass a `DayLookup` that classifies each date (the CLI builds it from data
 * fetched over HTTP). German labels mirror the web app's Year View; they are
 * redefined locally because `src/utils/calendar.ts` is off-limits to the CLI
 * (it imports feiertagejs — ADR-0001 / ADR-0002).
 */

export type DayKind = 'vacation-full' | 'vacation-half' | 'holiday' | 'weekend' | 'normal'

export interface DayInfo {
  readonly kind: DayKind
  readonly today: boolean
}

/** Classify an ISO `YYYY-MM-DD` date for rendering. */
export type DayLookup = (iso: string) => DayInfo

const MONTHS_FULL = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const MONTHS_ABBR = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** State-code → display name. Static reference data (see module note). */
export const STATE_NAMES: Record<string, string> = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg',
  HB: 'Bremen', HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz',
  SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
}

const MARKERS: Record<DayKind, string> = {
  'vacation-full': '█',
  'vacation-half': '½',
  holiday: '★',
  weekend: '·',
  normal: ' ',
}

const LEGEND = 'Legend: █ vacation  ½ half-day  ★ holiday  · weekend'

/** Visible width of one mini-month (7 days × 3 chars). */
const MONTH_WIDTH = 21
/** Gap between mini-months in the year grid. */
const GAP = '   '

function ansiCode(info: DayInfo): string {
  let code: string
  switch (info.kind) {
    case 'vacation-full': code = '30;42'; break // black on green
    case 'vacation-half': code = '30;43'; break // black on yellow
    case 'holiday': code = '31;1'; break // bold red
    case 'weekend': code = '90'; break // bright black
    default: code = ''
  }
  if (info.today) code = code ? `1;4;${code}` : '1;4'
  return code
}

function paint(text: string, info: DayInfo, color: boolean): string {
  if (!color) return text
  const code = ansiCode(info)
  return code ? `\x1b[${code}m${text}\x1b[0m` : text
}

function center(s: string, width: number): string {
  const pad = Math.max(0, width - s.length)
  const left = Math.floor(pad / 2)
  return ' '.repeat(left) + s + ' '.repeat(pad - left)
}

function pad2(n: string | number): string {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Monday-first index (0=Mon … 6=Sun) of the month's first day. */
function firstOffset(year: number, month0: number): number {
  return (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7
}

/** Render one month as a fixed 8-line block (title, weekday header, 6 week rows). */
function renderMonthBlock(
  year: number,
  month0: number,
  lookup: DayLookup,
  color: boolean,
  titleOverride?: string,
): string[] {
  const lines = [
    center(titleOverride ?? MONTHS_ABBR[month0], MONTH_WIDTH),
    WEEKDAYS.map((w) => `${w} `).join(''),
  ]

  const cells: string[] = []
  for (let i = 0; i < firstOffset(year, month0); i++) cells.push('   ')

  const total = daysInMonth(year, month0)
  for (let d = 1; d <= total; d++) {
    const iso = `${year}-${pad2(month0 + 1)}-${pad2(d)}`
    const info = lookup(iso)
    const text = String(d).padStart(2, ' ') + MARKERS[info.kind]
    cells.push(paint(text, info, color))
  }
  while (cells.length < 42) cells.push('   ')

  for (let w = 0; w < 6; w++) {
    lines.push(cells.slice(w * 7, w * 7 + 7).join(''))
  }
  return lines
}

function renderYear(year: number, stateName: string, lookup: DayLookup, color: boolean): string {
  const blocks = Array.from({ length: 12 }, (_, m) => renderMonthBlock(year, m, lookup, color))
  const rowWidth = MONTH_WIDTH * 3 + GAP.length * 2

  const lines: string[] = [center(`${year} — ${stateName}`, rowWidth), '']
  for (let row = 0; row < 4; row++) {
    const three = blocks.slice(row * 3, row * 3 + 3)
    for (let i = 0; i < three[0].length; i++) {
      lines.push(three.map((b) => b[i]).join(GAP))
    }
    lines.push('')
  }
  lines.push(LEGEND)
  return lines.join('\n')
}

function renderMonth(
  year: number,
  month0: number,
  stateName: string,
  lookup: DayLookup,
  color: boolean,
): string {
  const title = `${MONTHS_FULL[month0]} ${year} — ${stateName}`
  const block = renderMonthBlock(year, month0, lookup, color, title)
    .map((l) => l.replace(/\s+$/, ''))
  while (block.length > 0 && block[block.length - 1] === '') block.pop()
  return [...block, '', LEGEND].join('\n')
}

export interface CalendarRender {
  readonly year: number
  /** 1-12 to render a single month; omit for the full-year grid. */
  readonly month?: number
  readonly stateName: string
  readonly lookup: DayLookup
  readonly color: boolean
}

/** Render either a full-year 12-month grid or a single month. */
export function renderCalendar(o: CalendarRender): string {
  if (o.month !== undefined) {
    return renderMonth(o.year, o.month - 1, o.stateName, o.lookup, o.color)
  }
  return renderYear(o.year, o.stateName, o.lookup, o.color)
}
