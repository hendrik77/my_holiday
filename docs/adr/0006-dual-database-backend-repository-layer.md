# ADR-0006: Dual database backend (SQLite + PostgreSQL) behind a repository layer

**Date**: 2026-07-11
**Status**: accepted (2026-07-12, PR #55 merged)
**Deciders**: Hendrik Neumann

## Context

[VISION.md](../../VISION.md) v3 says "PostgreSQL replaces SQLite". A full
replacement would break the zero-dependency homelab/NAS deployment that
current users rely on, and the future Family & Household pillar explicitly
depends on running without infrastructure ("no full authentication system").
The data layer was a single ~200-line raw-SQL module (`server/db.ts`) with no
abstraction and no schema-migrations mechanism.

## Decision

Keep SQLite (better-sqlite3) as the permanent default for single-user mode
and add PostgreSQL (`pg`) as a second backend, required only when
`AUTH_MODE=oidc`. Both sit behind an async repository interface
(`server/db/`) whose methods take the owning `userId` first. Schema changes
run through a tiny in-repo, forward-only migrations runner; each migration
carries its SQL in both dialects (`up.sqlite` / `up.postgres`) and is tracked
in `schema_migrations`.

## Alternatives Considered

### Alternative 1: Full PostgreSQL replacement (as originally visioned)
- **Pros**: one backend; simpler Dockerfile (drops the native better-sqlite3 addon and the arm64 native-runner workaround in the release workflow)
- **Cons**: every personal user must run a PostgreSQL server
- **Why not**: kills the homelab profile and the Family pillar path; the personal planner is the product's core

### Alternative 2: ORM / query builder (drizzle, knex)
- **Pros**: dialect abstraction for free; mature migration tooling
- **Cons**: new dependency layer contrary to the codebase's raw-SQL style
- **Why not**: the schema is a handful of small tables; an ORM is more machinery than the dialect delta it hides

## Consequences

### Positive
- Zero behavior change for existing installs (SQLite + defaults untouched)
- PostgreSQL unlocks concurrent multi-user writes for v3
- A shared contract test suite (`server/__tests__/repo-contract.ts`) runs against both drivers and is the executable definition of the interface

### Negative
- Every migration is written twice (sqlite + postgres SQL)
- No generic async `transaction()` API (better-sqlite3 is synchronous) — bulk writes get dedicated repository methods instead

### Risks
- Driver behavior drift → mitigated by running the contract suite against both backends in CI (Postgres via service container, Phase 2)
