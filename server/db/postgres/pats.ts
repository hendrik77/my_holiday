import type { Pool } from 'pg';
import type { PatRow } from '../../types';
import type { PatsRepo } from '../types';
import { rowToPat } from '../rows';

/** PostgreSQL personal-access-token repository — same semantics as the SQLite driver, verified by the shared contract suite. */
export function createPostgresPatsRepo(pool: Pool): PatsRepo {
  return {
    async create(input): Promise<PatRow> {
      const { rows } = await pool.query(
        `INSERT INTO pats (id, user_id, name, token_hash, token_prefix, scope, expires_at, last_used_at, created_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, NULL) RETURNING *`,
        [
          crypto.randomUUID(),
          input.userId,
          input.name,
          input.tokenHash,
          input.tokenPrefix,
          input.scope,
          input.expiresAt,
          new Date().toISOString(),
        ],
      );
      return rowToPat(rows[0]);
    },

    async findByHash(tokenHash: string): Promise<PatRow | null> {
      const { rows } = await pool.query('SELECT * FROM pats WHERE token_hash = $1', [tokenHash]);
      return rows[0] ? rowToPat(rows[0]) : null;
    },

    async listForUser(userId: string): Promise<PatRow[]> {
      const { rows } = await pool.query('SELECT * FROM pats WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return rows.map(rowToPat);
    },

    async revoke(userId: string, id: string): Promise<boolean> {
      const result = await pool.query(
        'UPDATE pats SET revoked_at = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL',
        [new Date().toISOString(), id, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async touchLastUsed(id: string): Promise<void> {
      await pool.query('UPDATE pats SET last_used_at = $1 WHERE id = $2', [new Date().toISOString(), id]);
    },
  };
}
