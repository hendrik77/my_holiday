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

## 4. Further reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — tech stack, file structure, REST API, data model, key design decisions
- [VISION.md](./VISION.md) — long-term roadmap (Personal Enhancements, v3 multi-user, v4 company planner, AI/MCP)
- [DESIGN.md](./DESIGN.md) — design tokens, colour palette, typography, spacing
