# ADR-0007: OIDC authentication with cookie-based app sessions

**Date**: 2026-07-13
**Status**: accepted (2026-07-13, PR #57 merged)
**Deciders**: Hendrik Neumann

## Context

v3 multi-user mode needs authentication against external identity providers
(Entra ID, Authentik, Keycloak — [VISION.md](../../VISION.md)). The SPA is
served same-origin by the API ([ADR-0005](0005-same-origin-production-cors-allowlist.md)),
the CLI already speaks `Authorization: Bearer` (PATs land in Phase 6), and
single-user installs must keep working with zero configuration
([ADR-0006](0006-dual-database-backend-repository-layer.md)).

## Decision

- **openid-client v6** with issuer discovery and the authorization code flow
  + PKCE (S256) — one code path covers all three target IdPs.
- **App-issued sessions, not IdP tokens, authenticate API requests**:
  - `mh_session` — HS256 JWT (jose, `SESSION_SECRET`), 15 min TTL, claims
    `sub/role/name/email`, httpOnly `SameSite=Lax` cookie on `/`.
  - `mh_refresh` — opaque 256-bit token, 30 d TTL, httpOnly cookie scoped to
    `/api/v1/auth`, stored **sha256-hashed** in `refresh_tokens`
    (migration 003) with rotation families: every refresh rotates the token;
    replaying a rotated token revokes the entire family.
  - Login state (`state`, `nonce`, PKCE verifier) rides in a short-lived
    signed cookie (`mh_oidc`), so the flow is stateless server-side.
- **`AUTH_MODE` gate**: `none` (default) maps every request to the synthetic
  default user and preserves the legacy `API_TOKEN` guard verbatim
  ([ADR-0004](0004-opt-in-bearer-token-auth.md)); `oidc` requires the session
  cookie and rejects `API_TOKEN` at config validation.
- **Admin bootstrap** via `ADMIN_EMAILS`; all other role/team/manager
  assignments are admin-managed in-app.
- Auth endpoints under `/api/v1/auth` are mounted before the session guard;
  `trust proxy` is enabled in oidc mode and redirect URIs derive from
  `PUBLIC_BASE_URL`.

## Alternatives considered

- **Authorization header + localStorage tokens** — rejected: XSS-exfiltrable;
  httpOnly cookies are inert to script access, and same-origin serving plus
  `SameSite=Lax` and the strict CORS allowlist covers the CSRF story.
- **Server-side sessions** — rejected: a DB hit per request and sticky state;
  the 15-minute JWT plus rotating refresh gives revocation-on-refresh with
  stateless request handling.
- **Passport.js** — rejected: an abstraction layer over exactly one strategy;
  openid-client is the underlying library either way.

## Consequences

- In `oidc` mode ADR-0004's static bearer token no longer applies (superseding
  note added there); CLI access in multi-user mode arrives with PATs (Phase 6).
- Refresh-token reuse detection turns a stolen-then-replayed refresh cookie
  into a full family logout instead of a silent parallel session.
- The mock IdP (`server/test/mock-idp.ts`) keeps the whole flow testable
  without network access; real-IdP verification happens against a local
  Keycloak before release (Phase 8).
