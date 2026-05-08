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
 * CR / CRLF / LF are all encoded as a single literal \n to prevent
 * line-break injection into the calendar stream.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a content line if it exceeds 75 octets (RFC 5545 §3.1).
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const result: string[] = [];
  let currentLine = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = enc.encode(char).length;
    if (currentBytes + charBytes > 75) {
      result.push(currentLine);
      currentLine = ' ' + char;
      currentBytes = 1 + charBytes;
    } else {
      currentLine += char;
      currentBytes += charBytes;
    }
  }
  if (currentLine.length > 0) result.push(currentLine);

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
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
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

/** Trigger a browser download of a single vacation period as an .ics file. */
export function downloadSingleICS(period: VacationPeriod): void {
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Holiday//my-holiday//EN',
    generateICSForPeriod(period),
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `urlaub-${period.startDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
