import { getHolidays } from 'feiertagejs';

/** German state codes supported by feiertagejs */
export type GermanState = 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV' | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

/** State code → display name mapping */
export const GERMAN_STATES: { code: GermanState; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];

/**
 * Return a map of ISO date → holiday name for a range of years
 * and a specific German state. Uses feiertagejs internally.
 */
export function getHolidayMap(
  fromYear: number,
  toYear: number,
  state: GermanState
): Map<string, string> {
  const map = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) {
    const holidays = getHolidays(y.toString(), state);
    for (const h of holidays) {
      map.set(h.dateString, h.translate('de') || h.name);
    }
  }
  return map;
}
