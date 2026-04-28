# Development Rules

## 1. Always update README.md

Every feature, refactor, or significant change must be reflected in `README.md`. Keep it up to date with:
- New features and how to use them
- Updated project structure
- Changed data models
- New dependencies

## 2. RED-GREEN test principle

All new features follow test-driven development:

1. **RED** — Write a failing test first that defines the expected behaviour
2. **GREEN** — Implement the minimal code to make the test pass
3. **REFACTOR** — Clean up while keeping tests green

Tests live alongside source files (`src/**/*.test.ts`) using vitest. Run with `npm test`.

Existing features must not regress — all tests must pass before committing.
