import type { GermanState } from './data/holidays';
import type { Language } from './i18n/translations';

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

export interface VacationState {
  year: number;
  totalDays: number;
  state: GermanState;
  language: Language;
  theme: 'light' | 'dark' | 'auto';
  carryOverDays: number;
  periods: VacationPeriod[];
  view: ViewType;
  selectedMonth: number; // 0-11
  // Undo/redo (not persisted)
  _undoStack: VacationPeriod[][];
  _redoStack: VacationPeriod[][];
  canUndo: boolean;
  canRedo: boolean;
  // Employment
  employmentStartDate: string; // ISO date; empty string = not set
  employmentEndDate: string;   // ISO date; empty string = still employed
  // Carry-over policy
  carryOverDeadline: string;    // month-day, e.g. '03-31'
  carryOverMaxDays: number | null; // null = no cap
  // Bildungsurlaub
  bildungsUrlaubDays: number; // 0 = feature disabled
}

export interface VacationActions {
  setYear: (year: number) => void;
  setTotalDays: (days: number) => void;
  setView: (view: ViewType) => void;
  setSelectedMonth: (month: number) => void;
  addPeriod: (period: Omit<VacationPeriod, 'id'>) => void;
  updatePeriod: (id: string, updates: Partial<VacationPeriod>) => void;
  removePeriod: (id: string) => void;
  setCarryOverDays: (days: number) => void;
  importData: (totalDays: number, periods: Omit<VacationPeriod, 'id'>[]) => void;
  setState: (state: GermanState) => void;
  setLanguage: (language: Language) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  undo: () => void;
  redo: () => void;
  _pushUndo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setEmploymentStartDate: (date: string) => void;
  setEmploymentEndDate: (date: string) => void;
  setCarryOverDeadline: (deadline: string) => void;
  setCarryOverMaxDays: (days: number | null) => void;
  setBildungsUrlaubDays: (days: number) => void;
}
