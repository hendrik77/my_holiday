# ADR-0001: HTTP-only transport for the my-holiday CLI

**Date**: 2026-05-26
**Status**: accepted
**Deciders**: Hendrik Neumann

## Context

VISION.md introduces a `my-holiday` CLI so power users and AI agents can script
vacation operations. The app currently runs locally with a SQLite-backed Express
API, but the stated long-term goal is to host it on a homelab server and reach it
from any client. A CLI could either open the SQLite file directly (fast, simple
for local-only) or speak to the existing HTTP API. The transport choice is
load-bearing because it also constrains the future MCP-server pillar, which will
need the same surface.

## Decision

The CLI communicates with the server exclusively over the HTTP API (`/api/v1`).
It never opens the SQLite database directly. Local usage is treated as the special
case where the base URL is `http://localhost:3001/api/v1`; the base URL is
configurable via `--api` flag or `MY_HOLIDAY_API_URL`, and an `Authorization:
Bearer` header is plumbed from day one (server enforcement deferred to v3 auth).

## Alternatives Considered

### Alternative 1: Direct SQLite access from the CLI
- **Pros**: No network hop; simplest possible local setup; no need for new endpoints.
- **Cons**: Only works on the same host as the DB file; duplicates entitlement/CSV
  logic that already lives behind the API; breaks the moment the app is hosted remotely.
- **Why not**: Directly contradicts the homelab/remote-access goal and would force a
  rewrite once the server moves off the local machine.

### Alternative 2: Dual transport (SQLite locally, HTTP when remote)
- **Pros**: Fastest path for local use while still supporting remote.
- **Cons**: Two code paths to test and keep in sync; two auth/permission models;
  more surface for divergent behavior between "local" and "remote" modes.
- **Why not**: Doubles complexity and test burden for a marginal local-only speedup;
  violates KISS.

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive
- One transport to build, test, and document for both local and remote use.
- Unblocks the MCP-server pillar, which reuses the same HTTP endpoints.
- Forces useful server-side endpoints (`/remaining`, `/export.csv`, `/import`) that
  centralize entitlement and CSV logic instead of re-implementing it client-side.

### Negative
- Requires a running server even for local CLI use (no offline file-only mode).
- Adds three new server endpoints and the work to move computation server-side.

### Risks
- Network/server errors become a normal CLI failure mode — mitigated by explicit
  exit codes (2 = server/network, 1 = user error) and clear error messages.
