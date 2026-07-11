import type { PeriodRow, CreatePeriodInput, Settings, SettingsUpdate } from '../types';

/** Fields of a period that may be changed after creation. */
export type PeriodUpdate = Partial<Pick<PeriodRow, 'startDate' | 'endDate' | 'note' | 'halfDay' | 'type'>>;

/**
 * Repository interfaces (ADR-0006). Async so SQLite (sync driver) and
 * PostgreSQL (Phase 2) implement the same contract; every method takes the
 * owning userId first. In single-user mode callers pass DEFAULT_USER_ID —
 * the SQLite baseline schema ignores it until migration 002 adds user
 * scoping (Phase 3).
 */
export interface PeriodsRepo {
  listAll(userId: string): Promise<PeriodRow[]>;
  listByYear(userId: string, year: number): Promise<PeriodRow[]>;
  create(userId: string, input: CreatePeriodInput): Promise<PeriodRow>;
  update(userId: string, id: string, updates: PeriodUpdate): Promise<PeriodRow | null>;
  remove(userId: string, id: string): Promise<boolean>;
}

export interface SettingsRepo {
  get(userId: string): Promise<Settings>;
  update(userId: string, updates: SettingsUpdate): Promise<Settings>;
}

/** Aggregate handle to one database backend. Created via createDb(config). */
export interface Db {
  readonly driver: 'sqlite' | 'postgres';
  readonly periods: PeriodsRepo;
  readonly settings: SettingsRepo;
  /** Apply pending schema migrations (idempotent; the factory runs it once). */
  migrate(): Promise<void>;
  close(): Promise<void>;
}
