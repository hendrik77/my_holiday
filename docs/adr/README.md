# Architecture Decision Records

This directory records significant architectural decisions for `my_holiday`,
using the lightweight format proposed by Michael Nygard. Each ADR captures the
context, the decision, the alternatives considered, and the consequences.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-http-only-cli-transport.md) | HTTP-only transport for the my-holiday CLI | accepted | 2026-05-26 |
| [0002](0002-server-side-computation.md) | Compute entitlement, CSV export, and import server-side | accepted | 2026-05-26 |
| [0003](0003-holidays-endpoint.md) | Dedicated /holidays endpoint for server-computed public holidays | accepted | 2026-05-29 |
| [0004](0004-opt-in-bearer-token-auth.md) | Opt-in bearer-token auth for the API | accepted | 2026-07-06 |
| [0005](0005-same-origin-production-cors-allowlist.md) | Same-origin production — relative API base URL and local-origin CORS allowlist | accepted | 2026-07-06 |
| [0006](0006-dual-database-backend-repository-layer.md) | Dual database backend (SQLite + PostgreSQL) behind a repository layer | accepted | 2026-07-11 |
| [0007](0007-oidc-auth-cookie-sessions.md) | OIDC authentication with cookie-based app sessions | accepted | 2026-07-13 |
| [0008](0008-personal-access-tokens.md) | Personal access tokens for CLI/API access | proposed | 2026-07-13 |
