import type { VacationPeriod } from '../src/types';

/** Row shape from the periods table */
export interface PeriodRow extends VacationPeriod {
  changedAt: string; // ISO timestamp
  /** Work days consumed (Mon–Fri minus holidays); computed by GET /periods, not stored. */
  workDays?: number;
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

/** Role of a user in multi-user mode (v3). */
export type UserRole = 'employee' | 'manager' | 'admin';

/** Row shape from the users table (migration 002). */
export interface UserRow {
  id: string;
  /** OIDC subject claim; null for the synthetic single-user-mode user. */
  oidcSub: string | null;
  email: string;
  name: string;
  team: string;
  role: UserRole;
  managerId: string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Identity claims used to create/refresh a user on IdP login. */
export interface UpsertUserInput {
  oidcSub: string;
  email: string;
  name: string;
}

/** Admin-editable profile fields. */
export type UserProfileUpdate = Partial<Pick<UserRow, 'name' | 'team' | 'role' | 'managerId'>>;
