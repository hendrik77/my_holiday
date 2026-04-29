import type { GermanState } from './holidays';

export interface SchoolHolidayPeriod {
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
}

/**
 * School holidays per state per year.
 * Source: Kultusministerkonferenz (kmk.org) — 2025/2026 published dates.
 * Data stored as { "stateCode": [ { name, start, end }, ... ] }
 * Keys are "ST-YYYY" (e.g. "HE-2025").
 */
const DATA: Record<string, SchoolHolidayPeriod[]> = {
  // === 2025 ===
  'BW-2025': [
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-26' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-20' },
    { name: 'Sommerferien', start: '2025-07-31', end: '2025-09-13' },
    { name: 'Herbstferien', start: '2025-10-27', end: '2025-10-31' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'BY-2025': [
    { name: 'Frühjahrsferien', start: '2025-03-03', end: '2025-03-07' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-20' },
    { name: 'Sommerferien', start: '2025-08-01', end: '2025-09-15' },
    { name: 'Herbstferien', start: '2025-11-03', end: '2025-11-07' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'BE-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-24', end: '2025-09-06' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-11-01' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  'BB-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-24', end: '2025-09-06' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-11-01' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  'HB-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-04' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-07-03', end: '2025-08-13' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'HH-2025': [
    { name: 'Winterferien', start: '2025-01-31', end: '2025-01-31' },
    { name: 'Osterferien', start: '2025-03-10', end: '2025-03-21' },
    { name: 'Sommerferien', start: '2025-07-24', end: '2025-09-03' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-31' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'HE-2025': [
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-21' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-10' },
  ],
  'MV-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-15' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-23' },
    { name: 'Sommerferien', start: '2025-07-28', end: '2025-09-06' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-03' },
  ],
  'NI-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-04' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-07-03', end: '2025-08-13' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'NW-2025': [
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-26' },
    { name: 'Sommerferien', start: '2025-07-14', end: '2025-08-26' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-06' },
  ],
  'RP-2025': [
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-24' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'SL-2025': [
    { name: 'Fastnachtsferien', start: '2025-02-24', end: '2025-03-04' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-24' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'SN-2025': [
    { name: 'Winterferien', start: '2025-02-17', end: '2025-03-01' },
    { name: 'Osterferien', start: '2025-04-18', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  'ST-2025': [
    { name: 'Winterferien', start: '2025-01-27', end: '2025-01-31' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  'SH-2025': [
    { name: 'Osterferien', start: '2025-04-11', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-28', end: '2025-09-06' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-30' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-06' },
  ],
  'TH-2025': [
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-03' },
  ],

  // === 2026 ===
  'BW-2026': [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Pfingstferien', start: '2026-05-26', end: '2026-06-05' },
    { name: 'Sommerferien', start: '2026-07-30', end: '2026-09-12' },
    { name: 'Herbstferien', start: '2026-10-26', end: '2026-10-30' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-08' },
  ],
  'BY-2026': [
    { name: 'Frühjahrsferien', start: '2026-02-16', end: '2026-02-20' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Pfingstferien', start: '2026-05-26', end: '2026-06-05' },
    { name: 'Sommerferien', start: '2026-08-03', end: '2026-09-14' },
    { name: 'Herbstferien', start: '2026-11-02', end: '2026-11-06' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-05' },
  ],
  'BE-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-23', end: '2026-09-05' },
    { name: 'Herbstferien', start: '2026-10-19', end: '2026-10-31' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
  ],
  'BB-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-23', end: '2026-09-05' },
    { name: 'Herbstferien', start: '2026-10-19', end: '2026-10-31' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
  ],
  'HB-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-03' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-07-02', end: '2026-08-12' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-24' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'HH-2026': [
    { name: 'Winterferien', start: '2026-01-30', end: '2026-01-30' },
    { name: 'Osterferien', start: '2026-03-02', end: '2026-03-13' },
    { name: 'Sommerferien', start: '2026-07-16', end: '2026-08-26' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-23' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'HE-2026': [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
    { name: 'Herbstferien', start: '2026-10-05', end: '2026-10-16' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-09' },
  ],
  'MV-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-14' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-08' },
    { name: 'Sommerferien', start: '2026-07-27', end: '2026-09-05' },
    { name: 'Herbstferien', start: '2026-10-19', end: '2026-10-24' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
  ],
  'NI-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-03' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-07-02', end: '2026-08-12' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-24' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'NW-2026': [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-13', end: '2026-08-25' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-24' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'RP-2026': [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-23' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'SL-2026': [
    { name: 'Fastnachtsferien', start: '2026-02-16', end: '2026-02-21' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-23' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'SN-2026': [
    { name: 'Winterferien', start: '2026-02-09', end: '2026-02-21' },
    { name: 'Osterferien', start: '2026-04-03', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
    { name: 'Herbstferien', start: '2026-10-05', end: '2026-10-17' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
  ],
  'ST-2026': [
    { name: 'Winterferien', start: '2026-02-09', end: '2026-02-14' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-03' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
    { name: 'Herbstferien', start: '2026-10-12', end: '2026-10-24' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-05' },
  ],
  'SH-2026': [
    { name: 'Osterferien', start: '2026-04-02', end: '2026-04-17' },
    { name: 'Sommerferien', start: '2026-07-27', end: '2026-09-05' },
    { name: 'Herbstferien', start: '2026-10-19', end: '2026-10-30' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  ],
  'TH-2026': [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
    { name: 'Herbstferien', start: '2026-10-05', end: '2026-10-17' },
    { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-03' },
  ],
};

/** Cache for school holiday maps */
let _schoolCache: Map<string, string> | null = null;
let _schoolCacheKey = '';

function buildCache(year: number, state: GermanState): Map<string, string> {
  const map = new Map<string, string>();
  for (const y of [year - 1, year, year + 1]) {
    const key = `${state}-${y}`;
    const periods = DATA[key];
    if (!periods) continue;
    for (const p of periods) {
      const start = new Date(p.start);
      const end = new Date(p.end);
      const current = new Date(start);
      while (current <= end) {
        const iso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        map.set(iso, p.name);
        current.setDate(current.getDate() + 1);
      }
    }
  }
  return map;
}

export function isSchoolHoliday(date: Date, state: GermanState): boolean {
  const year = date.getFullYear();
  const cacheKey = `${state}-${year}`;
  if (!_schoolCache || _schoolCacheKey !== cacheKey) {
    _schoolCache = buildCache(year, state);
    _schoolCacheKey = cacheKey;
  }
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return _schoolCache.has(iso);
}
