# Development Rules & Agent Guidelines

## 1. Always update documentation

Every feature, refactor, or significant change must be reflected in the relevant docs:

**README.md** — keep up to date with:
- New features and how to use them
- Updated project structure
- Changed data models
- New dependencies

**CHANGELOG.md** — add an entry for every meaningful change. Follow the existing format (`### Added / Changed / Fixed` under a version heading).

**ARCHITECTURE.md** — update when the tech stack, file structure, REST API, data model, or a key design decision changes.

## 2. RED-GREEN test principle

All new features follow test-driven development:

1. **RED** — Write a failing test first that defines the expected behaviour
2. **GREEN** — Implement the minimal code to make the test pass
3. **REFACTOR** — Clean up while keeping tests green

Tests live alongside source files (`src/**/*.test.ts`) using vitest. Run with `npm test`.

Existing features must not regress — all tests must pass before committing.

**Larger features** — decompose into small phases, each its own RED→GREEN cycle that ends lint-clean; build the server endpoint(s) before the client that consumes them. Reuse the shared logic in `src/utils` (`entitlement`, `calendar`, `csv`, `ics`) and `server/db` instead of re-implementing German vacation law — one source of truth across the web app, the CLI, and the future MCP server (see [ADR-0002](./docs/adr/0002-server-side-computation.md)).

## 3. Commands reference

| Command | Purpose |
|---|---|
| `npm run dev` | Start frontend dev server (port 5173) |
| `npm run server` | Start backend API server (port 3001) |
| `npm run lint` | ESLint — run before every commit |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run test:e2e` | Playwright end-to-end smoke tests |
| `npm run build` | Production frontend build |
| `npm run build:cli` | Bundle the `holiday` CLI to `dist-cli/` (also runs automatically as `pretest`) |
| `npm run typecheck` | Type-check CLI + server (`typecheck:cli` and `typecheck:server`) |

## 4. Command-line interface

The project ships a `holiday` CLI — an HTTP client for the same REST API. See the [CLI section in README](./README.md#command-line-interface-cli) for the full reference. For agents:

- Build it with `npm run build:cli` (the `pretest` hook does this automatically before tests), then `npm link` for a global `holiday` command — or run the bundle directly with `node dist-cli/my-holiday.js`.
- Discover commands and flags with `holiday --help` and `holiday <command> --help`.
- Pass `--json` on any command for machine-readable output.
- Exit codes: `0` success, `1` user/usage error, `2` server/network error.

## 5. Further reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — tech stack, file structure, REST API, data model, key design decisions
- [docs/adr/](./docs/adr/README.md) — Architecture Decision Records: the "why" behind load-bearing choices (HTTP-only CLI transport, server-side computation, `/holidays` endpoint). Read before changing the CLI↔server boundary, and add a new ADR when making a comparable decision.
- [VISION.md](./VISION.md) — long-term roadmap (Personal Enhancements, v3 multi-user, v4 company planner, AI/MCP)
- [DESIGN.md](./DESIGN.md) — design tokens, colour palette, typography, spacing
