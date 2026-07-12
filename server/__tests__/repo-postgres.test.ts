import { describe, it } from 'vitest';
import { Pool } from 'pg';
import { describeRepoContract } from './repo-contract';
import { createDb } from '../db';
import { loadConfig } from '../config';

const url = process.env.TEST_DATABASE_URL;

/**
 * PostgreSQL leg of the repository contract (ADR-0006).
 *
 * Runs when TEST_DATABASE_URL is set — CI provides a service container.
 * Locally:
 *   docker compose --profile postgres up -d
 *   TEST_DATABASE_URL=postgres://holiday:holiday@localhost:5432/holiday npm test
 *
 * Every test gets a pristine schema: tables are dropped and the migration
 * runner re-applies from scratch, which also exercises migrations per test.
 */
if (url) {
  describeRepoContract('postgres', async () => {
    const admin = new Pool({ connectionString: url, max: 1 });
    try {
      await admin.query(
        'DROP TABLE IF EXISTS periods, settings, user_settings, refresh_tokens, users, schema_migrations CASCADE',
      );
    } finally {
      await admin.end();
    }
    return createDb(loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: url }));
  });
} else {
  describe('repo contract: postgres', () => {
    it.skip('requires TEST_DATABASE_URL (see docker compose --profile postgres)', () => {});
  });
}
