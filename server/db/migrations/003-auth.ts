import type { Migration } from '../migrate';

/**
 * Auth storage (Phase 4, ADR-0007): opaque refresh tokens, stored
 * sha256-hashed, grouped into rotation families for reuse detection.
 * Identical SQL for both dialects.
 */
const refreshTokens = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    family_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    rotated_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family_id);
`;

export const auth: Migration = {
  id: '003-auth',
  up: {
    sqlite: refreshTokens,
    postgres: refreshTokens,
  },
};
