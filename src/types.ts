import type { GermanState } from '../data/holidays';
import type { Language } from '../i18n/translations';

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
  state: GermanState;
  language: Language;
  theme: 'light' | 'dark' | 'auto';
  periods: VacationPeriod[];
  view: ViewType;
  selectedMonth: number; // 0-11
  // Undo/redo (not persisted)
  _undoStack: VacationPeriod[][];
  _redoStack: VacationPeriod[][];
  canUndo: boolean;
  canRedo: boolean;
}

export interface VacationActions {
  setYear: (year: number) => void;
  setTotalDays: (days: number) => void;
  setView: (view: ViewType) => void;
  setSelectedMonth: (month: number) => void;
  addPeriod: (period: Omit<VacationPeriod, 'id'>) => void;
  updatePeriod: (id: string, updates: Partial<VacationPeriod>) => void;
  removePeriod: (id: string) => void;
  importData: (totalDays: number, periods: Omit<VacationPeriod, 'id'>[]) => void;
  setState: (state: GermanState) => void;
  setLanguage: (language: Language) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  undo: () => void;
  redo: () => void;
  _pushUndo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
