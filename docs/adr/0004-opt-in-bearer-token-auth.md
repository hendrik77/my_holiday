# ADR-0004: Opt-in bearer-token auth for the API

**Date**: 2026-07-06 (recorded retrospectively 2026-07-08)
**Status**: accepted — superseded by [ADR-0007](0007-oidc-auth-cookie-sessions.md) in `AUTH_MODE=oidc`; still applies verbatim in single-user mode (`AUTH_MODE=none`)
**Deciders**: Hendrik Neumann

## Context

The security-hardening review before going public (PR #51) found the API fully
unauthenticated: anyone who can reach the port — a LAN neighbour, or a
malicious website via DNS rebinding — can read and write vacation data.
`my_holiday` is a single-user app (multi-user auth is a v3 roadmap item, see
VISION.md), typically deployed on localhost or a trusted homelab LAN, so
mandatory auth would punish the common case. The CLI already plumbs
`MY_HOLIDAY_API_TOKEN` into an `Authorization` header (ADR-0001), but the web
SPA has no mechanism to attach tokens.

## Decision

Add an opt-in `API_TOKEN` environment variable. When set, every `/api/v1`
request must carry `Authorization: Bearer <token>`, verified with a
timing-safe comparison of SHA-256 hashes; otherwise the server responds 401.
When unset, behaviour is unchanged. `/health` stays outside the guard so
Docker healthchecks and monitoring work without credentials.

## Alternatives Considered

### Alternative 1: Always-on auth (generated token on first start)
- **Pros**: secure by default; no way to forget to set it.
- **Cons**: breaks the zero-config localhost experience; the web UI cannot
  attach tokens, so the SPA would be unusable until a token-injection
  mechanism is built.
- **Why not**: for a single-user localhost app the friction outweighs the
  risk; the CORS allowlist (same PR) already blocks the browser-borne threat.

### Alternative 2: No auth — rely on network isolation / reverse proxy
- **Pros**: no code; standard homelab pattern (authenticating proxy in front).
- **Cons**: leaves LAN deployments open by default; DNS rebinding bypasses
  CORS since the Host-based request still reaches the API.
- **Why not**: a built-in option is needed for deployments without a proxy;
  the token also mitigates DNS rebinding, which CORS alone does not.

### Alternative 3: Full session/user auth now
- **Pros**: covers the web UI too; groundwork for multi-user.
- **Cons**: login UI, session storage, and user model for an app with exactly
  one user today.
- **Why not**: YAGNI — that's the v3 multi-user milestone; a bearer token
  covers the CLI/API surface until then.

## Consequences

### Positive
- LAN and homelab deployments can lock down the API with one env var.
- CLI works unchanged — it already sends `MY_HOLIDAY_API_TOKEN` (ADR-0001).
- Timing-safe hash comparison avoids token-length leaks and byte-by-byte
  timing oracles.
- Mitigates DNS rebinding: a rebound origin cannot supply the token.

### Negative
- The web UI does not attach tokens, so `API_TOKEN` effectively makes the
  deployment CLI/API-only (documented in `.env.example`).
- Opt-in means insecure-by-default; users must read SECURITY.md to know the
  option exists.

### Risks
- Token in an env var can leak via process listings or logs — mitigated by
  SECURITY.md guidance and by never logging the token.
- When the v3 web-UI auth lands, this mechanism should be superseded or
  folded into it — revisit then.

## Related

- Builds on [ADR-0001](0001-http-only-cli-transport.md) (CLI auth header
  plumbed from day one).
- Complements the CORS allowlist introduced in the same hardening PR (#51).
