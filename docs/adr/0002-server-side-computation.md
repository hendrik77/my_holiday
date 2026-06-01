# ADR-0002: Compute entitlement, CSV export, and import server-side

**Date**: 2026-05-26
**Status**: accepted
**Deciders**: Hendrik Neumann

## Context

Remaining-leave entitlement (pro-rata under § 4 BUrlG, leave reduction for
`elternzeit`, carry-over expiry), CSV export formatting, and CSV import
(parse + overlap detection) currently run in the browser via modules in
`src/utils/` (`entitlement.ts`, `calendar.ts`, `export.ts`). ADR-0001 commits the
CLI — and the future MCP server — to an HTTP-only transport, so those clients
cannot reuse browser-side computation: they have no DB access and would otherwise
re-implement German vacation law a second time. The existing API was built for the
browser and returns raw periods, leaving aggregation to the client.

## Decision

The server owns these computations and exposes them as endpoints:
`GET /api/v1/remaining`, `GET /api/v1/export.csv`, and `POST /api/v1/import`.
The pure formatting logic is extracted from the browser-coupled
`src/utils/export.ts` into a dependency-free `src/utils/csv.ts` (`formatCSV`), which
both `downloadCSV` (browser) and the new `/export.csv` handler import. Entitlement
and calendar helpers are reused as-is by the server handlers.

## Alternatives Considered

### Alternative 1: Keep computation client-side, reimplement in the CLI
- **Pros**: No new endpoints; server stays a thin CRUD layer.
- **Cons**: Two implementations of BUrlG entitlement and CSV rules to keep in sync;
  high risk of drift and divergent results between web and CLI.
- **Why not**: Vacation-law logic is the riskiest code to duplicate; a single source
  of truth is worth the endpoint cost.

### Alternative 2: Share a pure-logic module between client and CLI (no HTTP)
- **Pros**: One implementation of the math, imported by both.
- **Cons**: The CLI would still need the period data to feed the functions, which
  means either DB access (violates ADR-0001) or fetching raw periods over HTTP and
  aggregating locally — pushing aggregation back to every client.
- **Why not**: Conflicts with ADR-0001; the data lives server-side, so the
  computation belongs there too.

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive
- One authoritative implementation of entitlement, export, and import for all clients.
- `formatCSV` becomes browser-free and unit-testable in isolation.
- The MCP-server pillar inherits the same endpoints with no extra work.

### Negative
- Three new server handlers to build, test, and maintain.
- `src/utils/export.ts` must be refactored so `downloadCSV` delegates to the
  extracted `formatCSV` without changing the existing CSV contract.

### Risks
- Refactoring `formatCSV` could regress the CSV output format — mitigated by pure
  formatter tests (header row, semicolon delimiter, escaping) plus the existing
  browser-side export tests staying green.

## Related

- Builds on [ADR-0001](0001-http-only-cli-transport.md) (HTTP-only CLI transport).
