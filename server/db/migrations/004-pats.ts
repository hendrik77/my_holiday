import type { Migration } from '../migrate';

/**
 * Personal access tokens (Phase 6, ADR-0008): sha256-hashed bearer tokens
 * for the CLI/API, user-scoped and individually revocable. Identical SQL
 * for both dialects.
 */
const pats = `
  CREATE TABLE IF NOT EXISTS pats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('full', 'read')),
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pats_user ON pats (user_id, created_at);
`;

export const patsMigration: Migration = {
  id: '004-pats',
  up: {
    sqlite: pats,
    postgres: pats,
  },
};
