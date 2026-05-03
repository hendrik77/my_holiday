export type VacationType =
  | 'urlaub'
  | 'bildungsurlaub'
  | 'kur'
  | 'sabbatical'
  | 'unbezahlterUrlaub'
  | 'mutterschaftsurlaub'
  | 'elternzeit'
  | 'sonderurlaub';

export interface VacationPeriod {
  id: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  note: string;
  halfDay?: boolean; // only valid when startDate === endDate
  type?: VacationType; // defaults to 'urlaub' when absent
}

export type ViewType = 'dashboard' | 'year' | 'month' | 'list';
