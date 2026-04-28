import type { PublicHoliday } from '../types';

/**
 * Compute Easter Sunday for a given year using the
 * Anonymous Gregorian algorithm (valid for all Gregorian years).
 */
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Return all public holidays for Hesse (Frankfurt am Main)
 * for the given year.
 */
export function getHolidaysForYear(year: number): PublicHoliday[] {
  const easter = getEaster(year);

  const fixed: [number, number, string][] = [
    [0, 1, 'Neujahr'],
    [4, 1, 'Tag der Arbeit'],
    [9, 3, 'Tag der Deutschen Einheit'],
    [11, 25, '1. Weihnachtstag'],
    [11, 26, '2. Weihnachtstag'],
  ];

  const holidays: PublicHoliday[] = fixed.map(([month, day, name]) => ({
    date: toISO(new Date(year, month, day)),
    name,
  }));

  // Easter-dependent holidays
  holidays.push({ date: toISO(addDays(easter, -2)), name: 'Karfreitag' });
  holidays.push({ date: toISO(addDays(easter, 1)), name: 'Ostermontag' });
  holidays.push({ date: toISO(addDays(easter, 39)), name: 'Christi Himmelfahrt' });
  holidays.push({ date: toISO(addDays(easter, 50)), name: 'Pfingstmontag' });
  holidays.push({ date: toISO(addDays(easter, 60)), name: 'Fronleichnam' });

  holidays.sort((a, b) => a.date.localeCompare(b.date));
  return holidays;
}

/** Return all holidays across a range of years, indexed by ISO date. */
export function getHolidayMap(
  fromYear: number,
  toYear: number
): Map<string, string> {
  const map = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) {
    for (const h of getHolidaysForYear(y)) {
      map.set(h.date, h.name);
    }
  }
  return map;
}
