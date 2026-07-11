/**
 * Minimal in-repo migrations model (ADR-0006).
 *
 * Forward-only: every migration carries its own SQL per driver dialect and
 * is applied exactly once, tracked in `schema_migrations`. No down
 * migrations — restore from backup instead (homelab deployment profile).
 * Each driver implements the tiny apply loop itself (SQLite is synchronous,
 * PostgreSQL is not); `pendingMigrations` keeps the ordering/skip logic in
 * one place.
 */
export interface Migration {
  /** Stable unique id, ordered lexicographically (e.g. '001-baseline'). */
  id: string;
  up: {
    sqlite: string;
    postgres: string;
  };
}

export const SCHEMA_MIGRATIONS_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)';

/** Migrations not yet applied, in declaration order. */
export function pendingMigrations(migrations: Migration[], appliedIds: ReadonlySet<string>): Migration[] {
  return migrations.filter((m) => !appliedIds.has(m.id));
}
