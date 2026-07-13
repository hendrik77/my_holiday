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

/** What a personal access token may do: full API access or read-only. */
export type PatScope = 'full' | 'read';

/** Row shape from the pats table (migration 004). */
export interface PatRow {
  id: string;
  userId: string;
  /** User-chosen label, e.g. "CLI on laptop". */
  name: string;
  /** sha256 of the raw token — the raw value is shown exactly once. */
  tokenHash: string;
  /** First characters of the raw token, for recognizing it in lists. */
  tokenPrefix: string;
  scope: PatScope;
  expiresAt: string | null; // ISO timestamp
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** Response shape of GET /api/v1/auth/me — the acting user and auth mode. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  team: string;
  role: UserRole;
  authMode: 'none' | 'oidc';
}
