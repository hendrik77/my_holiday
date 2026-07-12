import type {
  PeriodRow,
  CreatePeriodInput,
  Settings,
  SettingsUpdate,
  UserRow,
  UpsertUserInput,
  UserProfileUpdate,
} from '../types';

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

/**
 * Users repository (migration 002, Phase 3). The synthetic default user
 * (DEFAULT_USER_ID) is inserted by the migration itself and owns all
 * pre-existing data.
 */
export interface UsersRepo {
  findById(id: string): Promise<UserRow | null>;
  findByOidcSub(oidcSub: string): Promise<UserRow | null>;
  /**
   * Create-or-refresh a user on IdP login, keyed by oidc_sub: inserts a new
   * employee on first login, updates email/name on subsequent logins.
   * Role/team/managerId are never touched — those are admin-managed.
   */
  upsertFromIdP(input: UpsertUserInput): Promise<UserRow>;
  listAll(): Promise<UserRow[]>;
  listDirectReports(managerId: string): Promise<UserRow[]>;
  updateProfile(id: string, updates: UserProfileUpdate): Promise<UserRow | null>;
}

/** Row shape from the refresh_tokens table (migration 003). */
export interface RefreshTokenRow {
  id: string;
  userId: string;
  /** sha256 of the opaque token — the raw value is never stored. */
  tokenHash: string;
  /** Rotation family: reuse of a rotated member revokes the whole family. */
  familyId: string;
  expiresAt: string; // ISO timestamp
  rotatedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Refresh-token store (Phase 4, ADR-0007). */
export interface RefreshTokensRepo {
  create(input: Pick<RefreshTokenRow, 'userId' | 'tokenHash' | 'familyId' | 'expiresAt'>): Promise<RefreshTokenRow>;
  findByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
  markRotated(id: string): Promise<void>;
  /** Revoke every token of a family; returns how many were newly revoked. */
  revokeFamily(familyId: string): Promise<number>;
  /** Housekeeping: drop tokens past expires_at; returns how many were removed. */
  deleteExpired(): Promise<number>;
}

/** Aggregate handle to one database backend. Created via createDb(config). */
export interface Db {
  readonly driver: 'sqlite' | 'postgres';
  readonly periods: PeriodsRepo;
  readonly settings: SettingsRepo;
  readonly users: UsersRepo;
  readonly refreshTokens: RefreshTokensRepo;
  /** Apply pending schema migrations (idempotent; the factory runs it once). */
  migrate(): Promise<void>;
  close(): Promise<void>;
}
