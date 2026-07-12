import type Database from 'better-sqlite3';
import type { RefreshTokensRepo, RefreshTokenRow } from '../types';
import { rowToRefreshToken } from '../rows';

/** SQLite refresh-token repository (migration 003). */
export function createSqliteRefreshTokensRepo(db: Database.Database): RefreshTokensRepo {
  return {
    async create(input): Promise<RefreshTokenRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, rotated_at, revoked_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
      ).run(id, input.userId, input.tokenHash, input.familyId, input.expiresAt, now);
      return {
        id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        rotatedAt: null,
        revokedAt: null,
        createdAt: now,
      };
    },

    async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
      const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToRefreshToken(row) : null;
    },

    async markRotated(id: string): Promise<void> {
      db.prepare('UPDATE refresh_tokens SET rotated_at = ? WHERE id = ? AND rotated_at IS NULL').run(
        new Date().toISOString(),
        id,
      );
    },

    async revokeFamily(familyId: string): Promise<number> {
      const result = db
        .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL')
        .run(new Date().toISOString(), familyId);
      return result.changes;
    },

    async deleteExpired(): Promise<number> {
      const result = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(new Date().toISOString());
      return result.changes;
    },
  };
}
