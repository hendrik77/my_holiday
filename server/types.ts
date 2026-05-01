import type { VacationPeriod } from '../src/types';

/** Row shape from the periods table */
export interface PeriodRow extends VacationPeriod {
  changedAt: string; // ISO timestamp
}

/** Parameters for creating a new period (no id, no changedAt) */
export type CreatePeriodInput = Omit<PeriodRow, 'id' | 'changedAt'>;

/** Settings as stored in the settings key-value table */
export interface Settings {
  totalDays: number;
  state: string;
  carryOverDays: number;
  carryOverDeadline: string;
  carryOverMaxDays: number | null;
  employmentStartDate: string;
  employmentEndDate: string;
  bildungsUrlaubDays: number;
}

/** Partial settings for updates */
export type SettingsUpdate = Partial<Settings>;
