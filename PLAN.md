# Plan: Implement `my-holiday` CLI

## Context

VISION.md section "AI / MCP / CLI Extensions" describes a `my-holiday` command-line interface so power users (and AI agents) can script vacation operations. The CLI must work against a remote server — the long-term goal is hosting the app on a homelab and accessing it from any client. Local-only operation is just a special case of remote (where the API URL is `http://localhost:3001`).

Commands in scope (from VISION.md):

```bash
my-holiday list [--year 2026]
my-holiday add --start 2026-07-01 --end 2026-07-15 --type urlaub --note "Sommerurlaub"
my-holiday remaining [--year 2026]
my-holiday export --format ics --year 2026
my-holiday migrate ./urlaub-2026.csv
```

The CLI talks to the existing HTTP API at `/api/v1`. Three new server endpoints are required (`/remaining`, `/export.csv`, `/import`) because the current API was built for the browser frontend and computes those values client-side. Adding them server-side also unblocks the future MCP server pillar, which will need the same surface.

**Design principles**
- HTTP-only — no direct SQLite access from the CLI. One transport for both local and remote.
- Configurable base URL: `--api <url>` flag overrides `MY_HOLIDAY_API_URL` env var, default `http://localhost:3001/api/v1`.
- Auth header is plumbed from day one (`--token` / `MY_HOLIDAY_API_TOKEN` → `Authorization: Bearer ...`) so the CLI is ready when v3 auth lands. Server does not enforce yet.
- Every command supports `--json` for machine-readable output (AI agents, scripts).
- Exit codes: `0` success, `1` user error (bad args, validation), `2` server/network error.

## TDD rule (applies to every task below)

Each task is executed strictly in **RED → GREEN** order:

1. **RED** — Write the test(s) first. Run them and **confirm they fail** for the expected reason (e.g. function doesn't exist, endpoint returns 404, exit code is 0 instead of 1). Capture the failure as part of the task evidence.
2. **GREEN** — Implement the minimum code that makes the tests pass. Run the full file's tests; do not stop until every assertion is green.
3. Tests written in step 1 are **not modified to chase green**. Tests are only edited later if a *subsequent* feature request changes the contract — and that change is itself another RED→GREEN cycle.
4. If during GREEN you discover the test was wrong, **stop**, surface it, and decide explicitly whether to change the test (only if the contract is wrong) or the code (always preferred).

A task is "done" only when (a) the originally-failing tests are now passing and (b) `npm run lint` is clean.

---

## Architecture

```
cli/
├── my-holiday.ts          # entry point, commander setup
├── api.ts                 # fetch wrapper, env/flag resolution, typed errors
├── commands/
│   ├── list.ts
│   ├── add.ts
│   ├── remaining.ts
│   ├── export.ts
│   └── migrate.ts
├── format.ts              # human-readable output helpers (table, summary)
└── __tests__/             # vitest unit tests for the CLI

server/
├── routes.ts              # + GET /remaining, GET /export.csv, POST /import
└── __tests__/
    └── routes.test.ts     # + tests for the three new endpoints

src/utils/
├── csv.ts                 # NEW — extract formatCSV() from export.ts (no browser deps)
└── __tests__/csv.test.ts  # NEW — pure formatter tests
```

**Reused, not re-implemented:**
- `src/utils/entitlement.ts` — `computeProRataEntitlement`, `computeLeaveReduction`
- `src/utils/calendar.ts` — `countVacationWorkDays`, `countCarryOverUsed`, `computeAutoCarryOver`, `hasOverlap`
- `src/utils/ics.ts` — `generateICS` (already used by `GET /export.ics`)
- `src/utils/export.ts` — `parseImportCSV` (reused server-side after extracting browser-free CSV formatting)
- `server/db.ts` — `createPeriod`, `getPeriodsByYear`, etc.

---

## Tasks (each is one RED → GREEN cycle)

### Phase 0 — Scaffolding

**T0.1 — CLI directory + build pipeline**
- **RED:** Add a vitest test that spawns `node dist-cli/my-holiday.js --version` and asserts the output equals `package.json` `version`. Run it — must fail (no build output yet).
- **GREEN:** Create `cli/my-holiday.ts` stub, `tsconfig.cli.json`, `build:cli` esbuild script, `"bin"` entry, then `npm run build:cli`. Test passes.

**T0.2 — commander setup**
- **RED:** Test that `node dist-cli/my-holiday.js --help` output contains each of `list`, `add`, `remaining`, `export`, `migrate`. Run — fails (no subcommands registered).
- **GREEN:** `npm install commander`; wire root program with global `--api`, `--token`, `--json`, and five empty subcommands. Test passes.

**T0.3 — HTTP client (`cli/api.ts`)**
- **RED:** Unit tests for `request<T>(path, init)`:
  - URL resolution: flag > env > default (`http://localhost:3001/api/v1`)
  - Authorization header present when token is provided, absent otherwise
  - 4xx/5xx responses throw `ApiError` with `status`, `body`, `message`
  Run — fails (module does not exist).
- **GREEN:** Implement `cli/api.ts` until all assertions pass.

**T0.4 — Error spine & client hardening (cross-cutting)**

Pulled forward from the original T5.1 review (#4, #5) plus the exit-code mapping. The *mechanism* lives here so every command from T2.1 on inherits one exit-code contract — honouring the "exit codes plumbed from day one" design principle. The end-to-end *verification* of that contract stays in T5.1.

- **RED:**
  - `cli/__tests__/errors.test.ts` for the pure `mapErrorToExit(err)`:
    - `UsageError` → exit 1
    - `ApiError` → exit 2
    - network `TypeError` → exit 2, message contains "network"
    - unknown error → exit 1
  - Append to `cli/__tests__/api.test.ts`:
    - **(#4)** a 2xx response with a non-JSON body throws a wrapped, descriptive `ApiError` — not a raw `SyntaxError`
    - **(#5)** a base URL with a trailing slash joins cleanly with a leading-slash path (no `//periods`)
  Run — fails (`cli/errors.ts` / `cli/exit-codes.ts` do not exist; `JSON.parse`/URL join not hardened).
- **GREEN:**
  - Add `cli/exit-codes.ts` (`EXIT.OK/USAGE/SERVER` = 0/1/2) and `cli/errors.ts` (`UsageError`, pure `mapErrorToExit`).
  - Guard `JSON.parse` in `request()` (wrap non-JSON 2xx bodies as `ApiError`) and normalize the base-URL ↔ path join.
  - Wrap the `cli/my-holiday.ts` entrypoint in `parseAsync` + a top-level `try/catch` via `.exitOverride()`, mapping `ApiError`/network `TypeError` → 2, `UsageError` → 1; with `--json`, errors print to stdout as `{"error": {...}}`.
  Tests pass; `npm run lint` clean.
- **Note:** `UsageError`'s first *consumer* is T3.1 (`add`). It is defined here as plumbing ahead of its consumer so the exit-code contract is centralized (DRY) rather than reimplemented per command.

### Phase 1 — Server API additions

**T1.1 — Extract `formatCSV()` to `src/utils/csv.ts`**
- **RED:** `src/utils/__tests__/csv.test.ts` covering:
  - header row matches existing CSV contract
  - semicolon delimiter, BOM-free
  - escaping for notes containing semicolons, double-quotes, and embedded newlines
  Run — fails (`src/utils/csv.ts` does not exist).
- **GREEN:** Move the string-building from `src/utils/export.ts:downloadCSV` into a pure `formatCSV(periods, year, state)`. Make `downloadCSV` delegate to it. Test passes; existing browser-side tests still pass.

**T1.2 — `GET /api/v1/remaining?year=YYYY`**
- **RED:** Append supertest cases to `server/__tests__/routes.test.ts` covering:
  - new hire (pro-rata under § 4 BUrlG)
  - full-year employee with no usage
  - year with `elternzeit` leave reduction
  - year with carry-over consumed before Mar 31
  Each asserts the full response shape `{ year, totalDays, entitledDays, usedDays, carryOver: {available, used, expiresOn}, remaining }`. Run — fails (404).
- **GREEN:** Implement the handler in `server/routes.ts`, reusing `computeProRataEntitlement`, `computeLeaveReduction`, `countVacationWorkDaysInYear`, `countCarryOverUsed`, `computeAutoCarryOver`. Tests pass.

**T1.3 — `GET /api/v1/export.csv?year=YYYY`**
- **RED:** Supertest asserting status 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` filename `urlaub-YYYY.csv`, body equals `formatCSV()` output for a fixture period set. Run — fails (404).
- **GREEN:** Implement the handler reusing `formatCSV` from T1.1. Test passes.

**T1.4 — `POST /api/v1/import`**
- **RED:** Supertest covering:
  - all-valid CSV → 200, `{ imported: N, skipped: [], errors: [] }`
  - one row overlaps existing period → 207, that row in `skipped` with reason `overlap`
  - malformed dates → 207, those rows in `errors`
  - no parseable rows → 400
  Run — fails (404).
- **GREEN:** Implement handler accepting `text/csv` body, reusing `parseImportCSV`, `hasOverlap`, `createPeriod`. Tests pass.

### Phase 2 — Read commands

**T2.1 — `my-holiday list [--year YYYY]`**
- **RED:** Unit test the command handler with a mocked `api.request`:
  - no year → calls `/periods`
  - `--year 2026` → calls `/periods?year=2026`
  - default output is a table with `Start | End | Days | Type | Note`
  - `--json` prints the raw API array
  Run — fails (handler not implemented).
- **GREEN:** Implement `cli/commands/list.ts` + register in entrypoint. Tests pass.

**T2.2 — `my-holiday remaining [--year YYYY]`**
- **RED:** Unit test with mocked `api.request`:
  - default year is current year (asserted with a fixed clock)
  - human output contains entitled / used / carry-over / remaining lines
  - `--json` prints raw response
  Run — fails.
- **GREEN:** Implement `cli/commands/remaining.ts`. Tests pass.

### Phase 3 — Write command

**T3.1 — `my-holiday add --start --end --type [--note] [--half-day]`**
- **RED:** Unit tests:
  - rejects bad date format with exit 1 (no fetch call made)
  - rejects unknown `--type` with exit 1 (no fetch call made)
  - happy path POSTs to `/periods` with correct body and prints `Added: <id> ...`
  - server 409 → prints overlap message, exit 1
  - server 400 → prints validation message, exit 1
  - `--json` prints the created record verbatim
  Run — fails.
- **GREEN:** Implement `cli/commands/add.ts` using `VALID_TYPES` from `src/types.ts`. Tests pass.

### Phase 4 — Bulk commands

**T4.1 — `my-holiday export --format ics|csv --year YYYY [--out FILE]`**
- **RED:** Unit tests with mocked fetch:
  - `--format ics` → hits `/export.ics`
  - `--format csv` → hits `/export.csv`
  - missing `--format` → exit 1, no fetch call
  - no `--out` → writes body to stdout
  - `--out path` → writes body to that file (verified by reading the temp file)
  Run — fails.
- **GREEN:** Implement `cli/commands/export.ts`. Tests pass.

**T4.2 — `my-holiday migrate <file> [--dry-run]`**
- **RED:** Unit tests:
  - reads CSV file from disk and POSTs body to `/import`
  - prints summary `Imported N, skipped N (reasons), errored N (rows)`
  - server returns partial (207) → exit 1
  - server returns success (200, no skipped/errored) → exit 0
  - `--dry-run` parses locally via `parseImportCSV`, prints what would import, **never** calls fetch (verified with a fetch spy)
  Run — fails.
- **GREEN:** Implement `cli/commands/migrate.ts`. Tests pass.

### Phase 5 — Polish & docs

**T5.1 — End-to-end exit-code verification & build hook**

The error-mapping mechanism (`mapErrorToExit`, entrypoint wrapper, `JSON.parse`/URL hardening) moved to **T0.4**. T5.1 now only *verifies* that contract through the built binary end-to-end, and makes the spawn suite self-contained.

- **RED:** Spawn-based vitest that runs the built CLI as a subprocess (exercising the real T0.4 mechanism, not mocks):
  - network failure (unreachable `--api`) → exit 2, stderr contains "network"
  - server 500 → exit 2
  - validation error (`add` with bad date) → exit 1
  - success → exit 0
  - with `--json`, errors print to stdout as `{"error": {...}}`
  Run — fails (binary not rebuilt / behaviours not yet wired through real commands).
- **GREEN:** Ensure the T0.4 spine and the relevant command handlers produce the asserted exit codes through the built binary. Tests pass.
- **(#3) Test infra:** spawn-based tests execute the gitignored `dist-cli/my-holiday.js`, so a clean `npm test` (without a prior build) fails with MODULE_NOT_FOUND. Add a `pretest` (or `pretest:cli`) hook that runs `npm run build:cli` so the suite is self-contained.

**T5.2 — README + AGENTS.md**
- No automated test — documentation only. Manual review checklist:
  - README "CLI" section lists install, env vars, every command, every flag
  - README documents that `npm run build:cli` produces `dist-cli/my-holiday.js` and must run before using the CLI (ties into the #3 build hook)
  - AGENTS.md mentions the CLI and the `--help` / `--json` discovery path
- **Done when:** `npm run lint` passes and both files render correctly.

**T5.3 — Repo-root PLAN.md**
- **RED:** N/A (file-existence task).
- **GREEN:** Copy this plan into `/Users/h.neumann/Devel/my_holiday/PLAN.md`. Done when the file exists with the same content as this harness plan.

---

## Critical files

**New**
- `cli/my-holiday.ts`, `cli/api.ts`, `cli/commands/*.ts`, `cli/format.ts`, `cli/__tests__/*.test.ts`
- `tsconfig.cli.json`
- `src/utils/csv.ts` + `src/utils/__tests__/csv.test.ts`
- `PLAN.md` (repo root, T5.3)

**Modified**
- `package.json` — `bin`, `build:cli`, `dev:cli` scripts, `commander` dep
- `server/routes.ts` — three new endpoints
- `server/__tests__/routes.test.ts` — tests for the new endpoints
- `src/utils/export.ts` — `downloadCSV` delegates to extracted `formatCSV`
- `README.md`, `AGENTS.md` — CLI section

---

## Verification (end-to-end)

After all phases:

1. `npm run build && npm run build:server && npm run build:cli && npm run typecheck:cli && npm run lint` — all green.
2. `npm test` — every test written in the RED step is now green; nothing regresses.
3. `npm run test:e2e` — existing frontend e2e suite still green.
4. Manual smoke:
   ```bash
   npm run dev:server &
   node dist-cli/my-holiday.js list --year 2026
   node dist-cli/my-holiday.js remaining --year 2026
   node dist-cli/my-holiday.js add --start 2026-09-01 --end 2026-09-05 --type urlaub --note "test"
   node dist-cli/my-holiday.js export --format ics --year 2026 --out /tmp/u.ics
   node dist-cli/my-holiday.js migrate ./fixtures/sample.csv --dry-run
   ```
5. AI-agent smoke: `my-holiday --help` and `my-holiday remaining --json` produce structured output an agent can consume without scraping.

---

## Out of scope (deferred)

- Server-side auth enforcement of the `Authorization` header — CLI sends the header now; the server starts honouring it when v3 multi-user auth lands.
- MCP server — separate vision pillar; this CLI work intentionally creates the HTTP endpoints it will need.
- Interactive prompts (no `--type` → prompt user). Keep v1 non-interactive so it scripts cleanly.
- Shell completion scripts. Add when there's demand.

## Follow-ups (discovered during implementation)

- **Server-side overlap check on `POST /api/v1/periods`.** `runAdd` (T3.1) maps a server `409` to an exit-1 overlap usage error, and that mapping is unit-tested — but `POST /periods` currently has no overlap detection, so it never returns `409` (an overlapping `add` succeeds with `201`). Add overlap detection server-side, reusing `hasOverlap` from `src/utils/calendar.ts` (the same util T1.4's import flow will use), returning `409` with an overlap message. Until then the `add` overlap path is dormant end-to-end.
- **Consolidate the vacation-type runtime lists.** _Mostly resolved (T4.2):_ `src/utils/export.ts`'s `VALID_TYPES` is gone — `parseImportCSV` (now in `csv.ts`) uses the canonical `VACATION_TYPES` from `src/types.ts`. Remaining: `src/components/VacationModal.tsx` still keeps its own `VACATION_TYPES` array; point it at the canonical export too.
- **Keep browser (DOM) code out of the server's import graph.** _Partially resolved (T4.2):_ `parseImportCSV` and its helpers moved to the browser-free `src/utils/csv.ts`, so `server/routes.ts` no longer imports `src/utils/export.ts` (the `downloadCSV`/`document`/`Blob`/`URL` module). Remaining: the server still imports `src/utils/ics.ts` for `generateICS`, which carries browser-only `downloadSingleICS`; and there is still no `typecheck:server` script (`tsc -p tsconfig.server.json` stays red from those DOM refs). Clean finish: split ICS generation from its download glue, then add a `typecheck:server` gate to CI.
- **`list`'s "Days" column is a calendar-day span, not working days.** T2.1's `formatCSV`-free `list` table computes `Days` as the inclusive calendar-day count (half-day → 0.5), because the command reads `/periods` only and working-day math needs the federal `state` (ADR 0002 keeps it server-side). The web UI shows working days via `countVacationWorkDaysInYear`. If parity matters, expose a server-computed `workDays` per period (e.g. enrich `/periods` or a dedicated field) and have `list` render that — its own RED→GREEN cycle.
- **Partial `migrate` prints its summary to stderr (non-json).** On a partial import `runMigrate` (T4.2) throws `UsageError(summary)` to get exit 1, so the human summary (`Imported N, skipped N (…)`) lands on **stderr**, not stdout. Defensible (exit 1 = not everything imported), but the counts the user wants are on the error stream. Consider printing the summary to stdout and signalling exit 1 separately. (The `--json` path is fine — fixed in `cacafb0`, structured result to stdout.)
- **CLI CSV export has no BOM.** `my-holiday export --format csv` streams the server's `formatCSV` output, which is BOM-free by design (T1.1/T1.3), whereas the **web** download prepends a UTF-8 BOM for Excel. German umlauts may render wrong when a CLI-exported CSV is opened in Excel on Windows. Consider an opt-in BOM for the CLI/file path, or document the difference.
