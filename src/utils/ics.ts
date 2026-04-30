import type { VacationPeriod } from '../types';
import { parseISODate } from './calendar';

/** Map vacation type to German summary label */
const TYPE_LABELS: Record<string, string> = {
  urlaub: 'Urlaub',
  bildungsurlaub: 'Bildungsurlaub',
  kur: 'Kur',
  sabbatical: 'Sabbatical',
  unbezahlterUrlaub: 'Unbezahlter Urlaub',
  mutterschaftsurlaub: 'Mutterschutz',
  elternzeit: 'Elternzeit',
  sonderurlaub: 'Sonderurlaub',
};

/**
 * Escape special characters for iCalendar text values.
 * RFC 5545 §3.3.11: escape \, ;, \n, \\
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold a content line if it exceeds 75 octets (RFC 5545 §3.1).
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const result: string[] = [];
  let remaining = line;

  while (remaining.length > 75) {
    result.push(remaining.slice(0, 75));
    remaining = ' ' + remaining.slice(75);
  }
  if (remaining.length > 0) {
    result.push(remaining);
  }

  return result.join('\r\n');
}

/**
 * Format a Date as ICS DATE value: YYYYMMDD
 */
function toICSDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Format a Date as ICS DATE-TIME value in UTC: YYYYMMDDTHHMMSSZ
 */
function toICSDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Generate a single VEVENT block from a vacation period.
 *
 * For all-day events, DTEND is the day after the last day (exclusive),
 * as required by RFC 5545 §3.6.1.
 */
export function generateICSForPeriod(period: VacationPeriod): string {
  const start = parseISODate(period.startDate);
  const end = parseISODate(period.endDate);

  // DTEND is exclusive: we set it to end + 1 day
  const dtEnd = new Date(end);
  dtEnd.setDate(dtEnd.getDate() + 1);

  const summary = TYPE_LABELS[period.type ?? 'urlaub'] ?? 'Urlaub';
  const now = new Date();

  const lines: string[] = [
    'BEGIN:VEVENT',
    foldLine(`DTSTART;VALUE=DATE:${toICSDate(start)}`),
    foldLine(`DTEND;VALUE=DATE:${toICSDate(dtEnd)}`),
    foldLine(`DTSTAMP:${toICSDateTime(now)}`),
    foldLine(`UID:${period.id}@my-holiday`),
    foldLine(`SUMMARY:${escapeText(summary)}`),
  ];

  if (period.note) {
    lines.push(foldLine(`DESCRIPTION:${escapeText(period.note)}`));
  }

  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * Generate a complete RFC 5545 iCalendar (.ics) file for the given
 * vacation periods within a specific year.
 *
 * Periods that fall partially outside the target year are clipped.
 * Periods entirely outside the target year are excluded.
 */
export function generateICS(
  periods: VacationPeriod[],
  year: number,
): string {
  const yearStartStr = `${year}-01-01`;
  const yearEndStr = `${year}-12-31`;

  // Build VCALENDAR header
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Holiday//my-holiday//EN',
    `X-WR-CALNAME:${escapeText('My Holiday')}`,
  ].join('\r\n');

  const events: string[] = [];

  for (const period of periods) {
    // Clip period to target year
    const clippedStart = period.startDate > yearStartStr ? period.startDate : yearStartStr;
    const clippedEnd = period.endDate < yearEndStr ? period.endDate : yearEndStr;

    // Skip if entirely outside the year
    if (clippedStart > clippedEnd) continue;

    // Generate event with clipped dates
    const clippedPeriod: VacationPeriod = {
      ...period,
      startDate: clippedStart,
      endDate: clippedEnd,
    };

    events.push(generateICSForPeriod(clippedPeriod));
  }

  const parts = [header, ...events, 'END:VCALENDAR'];
  return parts.join('\r\n') + '\r\n';
}
