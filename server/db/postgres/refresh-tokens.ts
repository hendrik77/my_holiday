import type { Pool } from 'pg';
import type { RefreshTokensRepo, RefreshTokenRow } from '../types';
import { rowToRefreshToken } from '../rows';

/** PostgreSQL refresh-token repository — same semantics as the SQLite driver, verified by the shared contract suite. */
export function createPostgresRefreshTokensRepo(pool: Pool): RefreshTokensRepo {
  return {
    async create(input): Promise<RefreshTokenRow> {
      const { rows } = await pool.query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, rotated_at, revoked_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6) RETURNING *`,
        [crypto.randomUUID(), input.userId, input.tokenHash, input.familyId, input.expiresAt, new Date().toISOString()],
      );
      return rowToRefreshToken(rows[0]);
    },

    async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
      const { rows } = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      return rows[0] ? rowToRefreshToken(rows[0]) : null;
    },

    async markRotated(id: string): Promise<void> {
      await pool.query('UPDATE refresh_tokens SET rotated_at = $1 WHERE id = $2 AND rotated_at IS NULL', [
        new Date().toISOString(),
        id,
      ]);
    },

    async revokeFamily(familyId: string): Promise<number> {
      const result = await pool.query(
        'UPDATE refresh_tokens SET revoked_at = $1 WHERE family_id = $2 AND revoked_at IS NULL',
        [new Date().toISOString(), familyId],
      );
      return result.rowCount ?? 0;
    },

    async deleteExpired(): Promise<number> {
      const result = await pool.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [new Date().toISOString()]);
      return result.rowCount ?? 0;
    },
  };
}
