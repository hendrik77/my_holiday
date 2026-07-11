import type { Config } from '../config';
import type { Db } from './types';
import { createSqliteDb } from './sqlite';
import { createPostgresDb } from './postgres';

export type { Db, PeriodsRepo, SettingsRepo, PeriodUpdate } from './types';
export { DEFAULT_USER_ID } from './constants';

/**
 * Open the configured database backend and bring its schema up to date.
 * SQLite is the single-user default; PostgreSQL is required for multi-user
 * mode (ADR-0006). Config validation guarantees DATABASE_URL is present
 * when DB_DRIVER=postgres.
 */
export async function createDb(config: Config): Promise<Db> {
  const db = config.DB_DRIVER === 'postgres' ? createPostgresDb(config) : createSqliteDb(config);
  await db.migrate();
  return db;
}
