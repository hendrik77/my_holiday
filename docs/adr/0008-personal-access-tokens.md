# ADR-0008: Personal access tokens for CLI/API access

**Date**: 2026-07-13
**Status**: proposed
**Deciders**: Hendrik Neumann

## Context

In multi-user mode ([ADR-0007](0007-oidc-auth-cookie-sessions.md)) the browser
authenticates with cookies, but the CLI and scripted API consumers cannot run
an OIDC browser flow. The CLI already sends `Authorization: Bearer <token>`
via `MY_HOLIDAY_API_TOKEN` ([ADR-0004](0004-opt-in-bearer-token-auth.md)), and
the shared static `API_TOKEN` is rejected in oidc mode because it is neither
user-scoped nor revocable.

## Decision

- **Format**: `mh_pat_` + 32 random bytes base64url. The raw value is
  returned exactly once at creation; only its sha256 hash is stored
  (migration 004), giving O(1) verification lookups.
- **Scopes**: `full` (read/write) and `read` (non-GET requests → 403).
- **Verification** lives in the same `requireUser` middleware as sessions:
  expiry and revocation are checked per request; `last_used_at` is stamped
  at most once per minute.
- **Issuance is session-cookie-only** (`/api/v1/tokens`, oidc mode): a PAT
  can never mint or revoke PATs, so a leaked CLI token cannot escalate into
  persistent access.
- **CLI: zero code change** — the existing `MY_HOLIDAY_API_TOKEN` Bearer
  plumbing works as-is; users paste a PAT instead of the legacy shared token.
- UI: token list/create/copy-once/revoke in the settings modal (oidc only).

## Alternatives considered

- **OAuth device flow** — rejected: per-IdP behavioral variance and real CLI
  work for marginal benefit at this scale.
- **Shared `API_TOKEN` in multi-user mode** — rejected: not user-scoped, not
  individually revocable, grants everyone the same identity.

## Consequences

- Webcal/ICS token-in-URL feeds remain **out of scope** — a PAT in a query
  string would leak into logs; a dedicated read-only feed token type can be
  designed later.
- Revocation is immediate (per-request DB check), at the cost of one indexed
  lookup per PAT-authenticated request.
