import type { VacationPeriod } from '../types';
import { generateICSForPeriod } from './ics';

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
