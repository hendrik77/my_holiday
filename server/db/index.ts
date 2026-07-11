import type { Config } from '../config';
import type { Db } from './types';
import { createSqliteDb } from './sqlite';

export type { Db, PeriodsRepo, SettingsRepo, PeriodUpdate } from './types';
export { DEFAULT_USER_ID } from './constants';

/**
 * Open the configured database backend and bring its schema up to date.
 * SQLite is the single-user default; PostgreSQL (DB_DRIVER=postgres)
 * arrives with the multi-user data layer in Phase 2.
 */
export async function createDb(config: Config): Promise<Db> {
  if (config.DB_DRIVER === 'postgres') {
    throw new Error('DB_DRIVER=postgres is not available yet — the PostgreSQL backend lands in v3 Phase 2');
  }
  const db = createSqliteDb(config);
  await db.migrate();
  return db;
}
