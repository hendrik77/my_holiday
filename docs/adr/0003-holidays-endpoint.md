# ADR-0003: Dedicated /holidays endpoint for server-computed public holidays

**Date**: 2026-05-29
**Status**: accepted
**Deciders**: Hendrik Neumann

## Context

The new `holiday calendar` command renders a terminal calendar that shades public
holidays. Under ADR-0001 the CLI is HTTP-only and under ADR-0002 it must not
re-implement German vacation/holiday logic — so it cannot run `feiertagejs`
itself. But no endpoint exposed holiday data: `GET /periods` only returns
per-period server-computed `workDays`, and the web SPA computes holidays
in-browser. The calendar also needs holidays on days with no booked vacation, so
periods alone cannot drive holiday shading. We needed a way for the CLI (and the
future MCP server) to obtain holiday dates over HTTP.

## Decision

Add a dedicated `GET /api/v1/holidays?year=YYYY[&state=XX]` endpoint that returns
public holidays as a sorted `[{ date, name }]` array, computed server-side via
`getHolidayMap` for the configured Bundesland (or a validated `?state=` override).

## Alternatives Considered

### Alternative 1: Aggregate `/calendar?year=` endpoint (periods + holidays in one response)
- **Pros**: a single round-trip for the calendar view; purpose-built payload.
- **Cons**: overlaps the existing `/periods` resource; couples a generic data
  endpoint to one consumer's view; more server-specific logic to maintain.
- **Why not**: a single-responsibility `/holidays` resource composes cleanly with
  the existing `/periods` and is reusable by other clients; the extra request is cheap.

### Alternative 2: Periods-only CLI calendar (no server change)
- **Pros**: no new endpoint; smallest change.
- **Cons**: public holidays render as ordinary days — the calendar diverges from
  the web Year View and loses most of its value for vacation planning.
- **Why not**: holiday shading is the point of the calendar.

### Alternative 3: Compute holidays in the CLI with feiertagejs
- **Pros**: no server round-trip.
- **Cons**: duplicates holiday logic in a second client; bundles `feiertagejs`
  into the CLI.
- **Why not**: directly violates ADR-0001 (HTTP-only) and ADR-0002 (server-side computation).

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive
- Holiday data is now available over HTTP to any client (CLI today, MCP server later).
- Single source of truth: `feiertagejs` runs only server-side, behind one endpoint.
- The CLI stays a thin HTTP client + pure renderer — no holiday computation leaks in.

### Negative
- The calendar makes three requests (`/periods`, `/holidays`, `/settings`) instead of one.
- One more endpoint to test and maintain.

### Risks
- Holiday names are locale-dependent (`translate('de')`) — acceptable for a German
  planner; revisit if the API gains i18n.
- State resolution defaults to the configured Bundesland — mitigated by the
  validated `?state=` override (invalid year/state → 400).

## Related

- Builds on [ADR-0001](0001-http-only-cli-transport.md) (HTTP-only CLI transport)
  and [ADR-0002](0002-server-side-computation.md) (server-side computation).
