import type { VacationPeriod } from '../types';
import type { GermanState } from '../data/holidays';
import { formatCSV } from './csv';

export { escapeCSV, parseImportCSV, type ImportResult } from './csv';

/** Export vacation data as a CSV file and trigger download */
export function downloadCSV(
  periods: VacationPeriod[],
  year: number,
  state: GermanState,
  t: (key: string, params?: Record<string, string | number>) => string
): void {
  const BOM = '﻿';
  const content = BOM + formatCSV(periods, state, {
    header: t('csv.header'),
    yes: t('csv.yes'),
    no: t('csv.no'),
  });
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  a.download = `urlaub-${year}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
