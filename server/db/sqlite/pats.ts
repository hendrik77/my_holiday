import type Database from 'better-sqlite3';
import type { PatRow } from '../../types';
import type { PatsRepo } from '../types';
import { rowToPat } from '../rows';

/** SQLite personal-access-token repository (migration 004). */
export function createSqlitePatsRepo(db: Database.Database): PatsRepo {
  return {
    async create(input): Promise<PatRow> {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO pats (id, user_id, name, token_hash, token_prefix, scope, expires_at, last_used_at, created_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
      ).run(id, input.userId, input.name, input.tokenHash, input.tokenPrefix, input.scope, input.expiresAt, now);
      return {
        id,
        userId: input.userId,
        name: input.name,
        tokenHash: input.tokenHash,
        tokenPrefix: input.tokenPrefix,
        scope: input.scope,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: now,
        revokedAt: null,
      };
    },

    async findByHash(tokenHash: string): Promise<PatRow | null> {
      const row = db.prepare('SELECT * FROM pats WHERE token_hash = ?').get(tokenHash) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToPat(row) : null;
    },

    async listForUser(userId: string): Promise<PatRow[]> {
      const rows = db
        .prepare('SELECT * FROM pats WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Record<string, unknown>[];
      return rows.map(rowToPat);
    },

    async revoke(userId: string, id: string): Promise<boolean> {
      const result = db
        .prepare('UPDATE pats SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
        .run(new Date().toISOString(), id, userId);
      return result.changes > 0;
    },

    async touchLastUsed(id: string): Promise<void> {
      db.prepare('UPDATE pats SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    },
  };
}
