/**
 * Synthetic owner of every row in single-user mode (AUTH_MODE=none).
 *
 * Phase 1–2: repositories accept a userId but the schema is not yet
 * user-scoped, so this constant is a placeholder identity. Migration 002
 * (Phase 3) inserts it as a real `users` row and assigns all existing
 * periods/settings to it, keeping existing installs' data intact.
 */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';
