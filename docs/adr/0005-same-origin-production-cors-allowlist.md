# ADR-0005: Same-origin production — relative API base URL and local-origin CORS allowlist

**Date**: 2026-07-06 (recorded retrospectively 2026-07-08)
**Status**: accepted
**Deciders**: Hendrik Neumann

## Context

Two related defects surfaced in the pre-public hardening review (PRs #44, #51).
The SPA bundle hardcoded `http://localhost:3001/api/v1`, so the app broke as
soon as it was served from a NAS/Pi/LAN hostname — every API call still went to
the visitor's own localhost. And the server reflected any `Origin` header back
in CORS, so any website could read and write the API from a visitor's browser.
Production already serves the SPA and the API from one Express process on one
port (`serveStatic`), which the hardcoded URL and permissive CORS both ignored.

## Decision

Treat same-origin as the production deployment model. The client resolves its
base URL via `resolveApiBaseUrl`: relative `/api/v1` in production builds,
`http://localhost:3001/api/v1` in dev (Vite on 5173 → API on 3001), with
`VITE_API_BASE_URL` overriding both at build time. The server's CORS defaults
to an allowlist of same-machine origins (`localhost`, `127.0.0.1`, `[::1]`, any
port); `CORS_ORIGIN` can open exactly one additional origin.

## Alternatives Considered

### Alternative 1: Runtime-injected API URL (config endpoint or window variable)
- **Pros**: one build artifact works for any deployment topology.
- **Cons**: extra moving part (bootstrap request or server-side HTML templating)
  to solve a problem same-origin serving doesn't have.
- **Why not**: the server already serves the SPA, so a relative path is
  zero-config for every hostname; the build-time override covers the rest.

### Alternative 2: Keep reflected/wildcard CORS
- **Pros**: nothing to configure; works for any split deployment.
- **Cons**: any website a user visits can read and write their vacation data;
  reflecting the origin defeats the point of CORS entirely.
- **Why not**: this was the vulnerability, not a design option.

### Alternative 3: Drop CORS entirely (strict same-origin only)
- **Pros**: smallest possible surface; production needs no CORS at all.
- **Cons**: breaks the dev setup (5173 → 3001 is cross-origin) and forecloses
  legitimate split deployments (SPA on a CDN, API elsewhere).
- **Why not**: the local-origin allowlist keeps dev working by default, and
  `CORS_ORIGIN` + `VITE_API_BASE_URL` keep split deployments possible.

## Consequences

### Positive
- The app works unmodified from any hostname — localhost, LAN IP, mDNS name,
  or behind a reverse proxy — because production requests are same-origin.
- Cross-origin browser attacks on the API are blocked by default.
- Dev workflow is unchanged: the allowlist covers the Vite-to-API hop.

### Negative
- Split-host deployments need two settings in concert: `VITE_API_BASE_URL`
  (build time) and `CORS_ORIGIN` (runtime).
- `CORS_ORIGIN` accepts a single origin; multiple extra origins would need a
  code change.

### Risks
- CORS does not stop DNS rebinding — a rebound hostname reaches the API with
  no `Origin` header. Mitigated by the opt-in bearer token
  ([ADR-0004](0004-opt-in-bearer-token-auth.md)).
- `resolveApiBaseUrl` depends on Vite's `PROD` flag; a misconfigured build
  would silently fall back to the dev URL — covered by unit tests on the
  resolver.

## Related

- [ADR-0004](0004-opt-in-bearer-token-auth.md) — the bearer token covers the
  DNS-rebinding gap that CORS cannot.
- Shipped across PR #44 (relative base URL, `createApp` extraction) and
  PR #51 (CORS allowlist).
