export interface VacationPeriod {
  id: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  note: string;
  halfDay?: boolean; // only valid when startDate === endDate
}

export type ViewType = 'dashboard' | 'year' | 'month' | 'list';

export interface VacationState {
  year: number;
  totalDays: number;
  periods: VacationPeriod[];
  view: ViewType;
  selectedMonth: number; // 0-11
}

export interface VacationActions {
  setYear: (year: number) => void;
  setTotalDays: (days: number) => void;
  setView: (view: ViewType) => void;
  setSelectedMonth: (month: number) => void;
  addPeriod: (period: Omit<VacationPeriod, 'id'>) => void;
  updatePeriod: (id: string, updates: Partial<VacationPeriod>) => void;
  removePeriod: (id: string) => void;
}

export interface PublicHoliday {
  date: string; // ISO date
  name: string;
}
