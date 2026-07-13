export type VacationType =
  | 'urlaub'
  | 'bildungsurlaub'
  | 'kur'
  | 'sabbatical'
  | 'unbezahlterUrlaub'
  | 'mutterschaftsurlaub'
  | 'elternzeit'
  | 'sonderurlaub';

/** Canonical runtime list of all vacation types (mirrors the VacationType union). */
export const VACATION_TYPES: readonly VacationType[] = [
  'urlaub',
  'bildungsurlaub',
  'kur',
  'sabbatical',
  'unbezahlterUrlaub',
  'mutterschaftsurlaub',
  'elternzeit',
  'sonderurlaub',
];

export interface VacationPeriod {
  id: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  note: string;
  halfDay?: boolean; // only valid when startDate === endDate
  type?: VacationType; // defaults to 'urlaub' when absent
}

/**
 * Non-blocking advisory attached to a period write (POST/PUT) when the booking
 * pushes a year's Urlaub total past the available entitlement. `remaining` is
 * the entitled-minus-used balance and is negative when the quota is exceeded.
 */
export interface QuotaWarning {
  code: 'quota-exceeded';
  year: number;
  entitledDays: number;
  usedDays: number;
  remaining: number;
}

export type ViewType = 'dashboard' | 'year' | 'month' | 'list' | 'team';
