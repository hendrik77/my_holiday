# Changelog

All notable changes to My Holiday.

---

## v2.4.0 (2026-07-06)

### Security
- **CORS now defaults to local origins only** — previously the API reflected *any* origin, so any website open in your browser could read and modify your vacation data on `localhost:3001`. Cross-origin access is now limited to `localhost` / `127.0.0.1` / `[::1]` origins; set `CORS_ORIGIN` to allow one specific extra origin. Same-origin use (served SPA, CLI, curl) is unaffected
- **Opt-in bearer-token auth (`API_TOKEN`)** — when the env var is set, every `/api/v1` request must send `Authorization: Bearer <token>` (timing-safe comparison). The CLI already supports this via `MY_HOLIDAY_API_TOKEN` / `--token`; also mitigates DNS-rebinding attacks
- **CSV formula-injection guard** — exported notes starting with `=`, `+`, `-`, `@` (or tab/CR) are prefixed with a guard apostrophe so spreadsheets display instead of execute them (OWASP CSV injection); the importer strips the guard so notes survive a round trip

### Added
- **`GET /health`** — unauthenticated liveness endpoint (`{"status":"ok"}`); the Docker image now ships a `HEALTHCHECK` that probes it
- **Docker hardening** — the container runs as the unprivileged `node` user (uid 1000) instead of root; base image bumped to `node:22-alpine`. Bind-mounted `./data` directories must be writable by uid 1000
- **Stricter settings validation** — day-count settings (`totalDays`, `carryOverDays`, `carryOverMaxDays`, `bildungsUrlaubDays`) must now be real integers within 0/1–60, matching the UI bounds (previously `totalDays` accepted up to 365 and values like `"30abc"` were truncated)
- **JSON 404 for unknown API paths** — `/api/*` routes that don't exist return `{"error":"Not found"}` instead of falling through to the SPA's `index.html`
- **School-holiday data validation & live updates** — responses from ferien-api.de are schema-validated (malformed entries dropped, corrupt multi-year periods skipped) and loaded via TanStack Query, so the calendar stripes appear as soon as the data arrives instead of after the next unrelated re-render

### Fixed
- **SPA now works when accessed from another device** — the production bundle hardcoded `http://localhost:3001/api/v1` as API base URL, so opening the Docker container from a NAS/Pi/LAN address made every API call target the *visitor's* machine and fail. Production builds now use the relative `/api/v1` (same origin); `VITE_API_BASE_URL` still overrides at build time
- **Malformed JSON returns 400, not 500** — errors thrown by middleware (JSON body parser, size limit) now keep their status code (`400` bad JSON, `413` over the 32 kb limit) instead of being masked as `Internal server error`
- **Invalid `year` on `/export.ics` and `/export.csv` returns 400** — previously a non-numeric year silently exported the current year; now consistent with `GET /periods`
- **`GET /periods?year=0`** is treated as a (empty) year filter instead of returning all periods
- **Dependency audit** — `npm audit fix` resolves the undici advisory GHSA-pr7r-676h-xcf6 (high)

### Changed
- **Server refactor** — app assembly extracted from `server/index.ts` into `createApp()` in `server/app.ts` so middleware (error handler, CORS) is covered by supertest integration tests

### Docs
- **DESIGN.md rewritten from source** — tokens now mirror `src/index.css` exactly (including the dark theme); the leftover site-extraction artefacts (placeholder font names, broken button specs, contradictory radius scale) are gone
- **ARCHITECTURE.md** — corrected the settings field casing (`bildungsUrlaubDays`), added `server/app.ts`, `components/toastStore.ts` and the `__tests__/` directories to the structure tree, documented `GET /health`
- **README / AGENTS.md** — removed the hardcoded test count (drifts every PR), documented all test locations

---

## v2.3.5 (2026-06-02)

### Fixed
- **Reject reversed date ranges** — `POST`/`PUT /api/v1/periods` (and thus `holiday add`/`change`) now return `400` when the end date is before the start; a reversed period previously stored but counted as 0 work days. Single-day periods (start == end) remain valid
- **CLI handles a closed output pipe** — `holiday … | head` (or any reader that closes stdout early) no longer crashes with an unhandled `EPIPE`; the command exits cleanly

---

## v2.3.4 (2026-06-02)

### Added
- **`holiday delete <id>`** — delete a vacation period by id or unique prefix (from `holiday list`); `--json` returns a structured confirmation. Completes CLI CRUD (`add` / `list` / `change` / `delete`)

---

## v2.3.3 (2026-06-01)

### Added
- **`holiday change <id>`** — edit an existing vacation period (partial update via `PUT /periods/:id`): change `--start`/`--end`/`--type`/`--note` or toggle `--half-day`/`--no-half-day`; only the flags you pass are sent. Accepts a unique id prefix, and `holiday list` now shows a short **ID** column to copy from

### Changed
- **`holiday add` — `--end` is now optional** — omit it for a single-day (or `--half-day`) vacation; it defaults to `--start`
- **Release builds arm64 on native runners** — multi-arch images are now built without QEMU (amd64 on `ubuntu-latest`, arm64 on `ubuntu-24.04-arm`), fixing the emulated `better-sqlite3` build flakiness and speeding releases

---

## v2.3.2 (2026-06-01)

### Added
- **`holiday --help <command>`** — per-command help is now reachable in flag-first order too (commander ignored the trailing command before); `holiday <command> --help` and `holiday help <command>` remain equivalent
- **Richer per-command help** — each command's help shows a curated usage signature (e.g. `holiday add --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--type <type>] …`), an example, and the global options (`--json` / `--api` / `--token`)

### Fixed
- **CLI runs standalone** — `build:cli` now bundles its only dependency (`commander`) into `dist-cli/my-holiday.js` instead of leaving it external, so the single file runs anywhere with just Node (no `node_modules` required); previously it threw `ERR_MODULE_NOT_FOUND` when run outside a full checkout

### Changed
- **README**: documented the GHCR pre-built/multi-arch image, a copy-paste `MY_HOLIDAY_API_URL` export, the self-contained CLI bundle, the `--help <command>` forms, and a more robust zsh completion install hint (`mkdir -p` the target dir)

---

## v2.3.1 (2026-06-01)

### Added
- **Multi-arch Docker images** — the release now publishes `linux/amd64` **and** `linux/arm64`, so ARM hosts (Apple Silicon, Raspberry Pi, ARM NAS) pull a native image instead of emulating amd64. `docker pull` auto-selects the host architecture
- **README: pre-built image instructions** — documents pulling/running/updating `ghcr.io/hendrik77/my_holiday` from GHCR

### Changed
- **CI now builds the Docker image on every PR** — Dockerfile / native-addon (`better-sqlite3`) build failures are caught before merge, instead of only at release-tag time

---

## v2.3.0 (2026-06-01)

### Added
- **Command-line interface (`holiday`)** — HTTP-only CLI for power users and AI agents, talking to the same REST API as the web app (local or remote). Commands: `list`, `add`, `remaining`, `export`, `migrate`, `calendar`, `today`, `completion`. Global `--api` / `--token` (or `MY_HOLIDAY_API_URL` / `MY_HOLIDAY_API_TOKEN`), `--json` on every command, exit codes `0`/`1`/`2`. Bundled to `dist-cli/` via esbuild; `npm link` exposes a global `holiday` command
- **`holiday calendar`** — terminal calendar: full-year German 12-month grid (or one month via `--month`) shading vacation, half-days, public holidays and weekends; TTY-gated ANSI color (`--no-color` / `NO_COLOR` respected)
- **`holiday today`** — one-line status: remaining days plus the active/next vacation (`--json` for structured output)
- **`holiday completion <bash\|zsh\|fish>`** — shell completion scripts; `--type` values sourced from the canonical `VACATION_TYPES` so they cannot drift
- **New server endpoints** — `GET /api/v1/remaining`, `GET /api/v1/export.csv`, `POST /api/v1/import`, and `GET /api/v1/holidays?year=[&state=]` (public holidays as `{date,name}`), centralising entitlement / CSV / holiday computation server-side for all clients
- **`export --bom`** — opt-in UTF-8 BOM on CLI CSV output for Excel
- **Architecture Decision Records** — `docs/adr/` with ADR-0001 (HTTP-only CLI transport), ADR-0002 (server-side computation), and ADR-0003 (dedicated `/holidays` endpoint)
- **Build & type-check scripts** — `build:cli`, `build:server`, `typecheck:cli`, `typecheck:server`, and a combined `typecheck`; a `pretest` hook builds the CLI bundle so the suite is self-contained

### Changed
- **`GET /api/v1/periods`** now returns a server-computed `workDays` per period (from the configured Bundesland); the CLI `list` renders it, falling back to the calendar-day span only when absent
- **CSV/ICS refactor** — `formatCSV` extracted into a browser-free `src/utils/csv.ts` shared by the web download and `/export.csv`; `downloadSingleICS` moved to `src/utils/icsDownload.ts` to keep `ics.ts` DOM-free
- **CLI command renamed** from `my-holiday` to `holiday` (the `bin` entry); the bundle carries a `#!/usr/bin/env node` shebang so it runs without a `node` prefix once linked
- **Dependency updates** (Dependabot) — `react`/`react-dom`, `zustand`, `better-sqlite3`, `typescript-eslint`, and the dev-tooling group bumped to their latest minor/patch versions
- **`package.json` version** set to `2.3.0` so `holiday --version` reports the real release

---

## v2.2.0 (2026-05-19)

### Added
- **ARCHITECTURE.md** — dedicated architecture document extracted from README; covers tech stack, file structure, REST API, data model, state flow, and key design decisions
- **Vacation type in CSV export/import** — `Type` column added to `Start Date;End Date;Note;Type;Half Day;Work Days` format; valid type keys are round-tripped on import; unknown values fall back to `urlaub`

### Changed
- **README restructure** — screenshots added, Features grouped into categories, sections reordered (Features before Setup, Architecture replaced by link to ARCHITECTURE.md, AI Development Team moved to bottom), "Running tests" renamed to "Development"
- **CSV column headers** — both DE and EN locales now use English column names for consistent round-tripping

---

## v2.1.0 (2026-05-16)

### Added
- **Docker distribution** — multi-stage `Dockerfile` (build + runtime), `docker-compose.yml`, `.dockerignore`; single container serves frontend + API on port 3001
- **`build:server` script** — esbuild bundles server TypeScript to ESM for Docker runtime
- **SECURITY.md** — vulnerability reporting policy
- **`.env.example`** — documented server environment variables
- **Dependabot** — weekly npm dependency updates grouped by dev-tooling vs runtime
- **GitHub Actions CI** — lint + unit tests + E2E on every push and pull request

### Fixed
- **Vacation colour hidden in light mode** — when a calendar cell had both `.vacation` and `.school-holiday` classes, the school-holiday `background` shorthand erased the vacation colour; fixed by splitting into `background-color` / `background-image`

---

## v2.0.0 (2026-05-01)

### Added
- **First-run wizard** — 4-step onboarding modal shown on clean install
  - Step 1: Employment dates (start, end, "still employed" toggle)
  - Step 2: Bundesland selection
  - Step 3: Annual vacation days (1–60)
  - Step 4: Carry-over policy (deadline March 31 / June 30, optional max cap)
- 7 component tests for FirstRunWizard
- **8 vacation types** — `urlaub`, `bildungsurlaub`, `kur`, `sabbatical`, `unbezahlterUrlaub`, `mutterschaftsurlaub`, `elternzeit`, `sonderurlaub`
- Colour-coded type badges in Dashboard upcoming list
- Bildungsurlaub counter (own budget, configurable in settings)
- Type stored on add/update
- **iCal export** — client-side RFC 5545 `.ics` download; server endpoint `GET /api/v1/export.ics?year=YYYY`
- Per-period iCal download button in list view
- **Express + SQLite backend** — REST API with 7 endpoints: CRUD for vacation periods, settings, iCal export
- `better-sqlite3` database at `data/my-holiday.db` with `periods` and `settings` tables
- `changed_at` tracking on every period mutation
- 28 supertest + DB unit tests
- **Migration script** — `npx tsx scripts/migrate-v1.ts ./urlaub-2026.csv` imports v1 CSV → v2 SQLite; idempotent
- 8 migration tests (valid CSV, idempotency, empty file, missing header, corrupt dates)
- **Playwright E2E smoke tests** — 5 tests: wizard, vacation planning, view switching, settings
- `playwright.config.ts` with dual webServer (Vite + Express)
- `npm run test:e2e` script
- **Component tests** — React Testing Library for Dashboard, ListView, FirstRunWizard, SettingsModal, VacationModal; 221 tests total
- **Pro-rata & leave-reduction utilities** — `computeProRataEntitlement`, `countFullCalendarMonths`, `computeLeaveReduction` (§ 4 BUrlG, § 17 BUrlG/BEEG); 44 tests
- **ICS generation utility** — RFC 5545 with line folding, escaping, year clipping; 20 tests

### Changed
- **TanStack Query frontend** — replaced Zustand persist + localStorage with `@tanstack/react-query` hooks backed by Express REST API
- New API layer: `src/api/client.ts` + `src/api/hooks.ts`
- Slim Zustand store — UI-only state (view, year, month, theme, language)
- All data persisted to SQLite via the API; no more localStorage
- **Dynamic school holidays** — fetches from `ferien-api.de`; 2025–2026 data retained as offline fallback
- **CSS refactor** — split 1090-line `App.css` into 8 co-located files; design tokens stay in `index.css`

### Fixed (post-release)
- Employment start/end date fields added to SettingsModal (were missing from UI)
- Effective entitlement (pro-rata + leave reduction) wired into Dashboard display
- `usedDays` counter now counts only `urlaub` type (not all vacation types)
- Import/export moved to settings modal; iCal export moved to list view
- API hardening: localhost bind, ICS carriage-return escaping, settings validation
- Scrollable modals on small screens; removed empty days hint; deduplicated list day count
- Toast store renamed (`useStore` → `useUIStore`)
- SQLite `data/` directory auto-created on first start
- Nav.css not imported in Nav.tsx
- Rules-of-Hooks violation in App.tsx

---

## v1.0.4 (2026-04-30)

### Added
- **Carry-over tracker** — enter days carried over from the previous year; auto-calculated on year switch; Dashboard shows progress bar, deadline warning (March 31), and expiry notice
- **Click-to-edit on Dashboard** — clicking any upcoming vacation opens the edit modal directly

---

## v1.0.3 (2026-04-29)

### Fixed
- Build broken: `'HE'` missing from `GermanState` union
- Broken imports in `src/types.ts`
- Dead theme picker in SettingsModal now wired up
- Crashing delete in ListView (missing `showToast` import)
- `setState`-in-render in VacationModal replaced with event handlers
- Stale work-day count when switching Bundesland with modal open
- `halfDay` coerced to `false` on multi-day CSV import rows

### Changed
- Toast store extracted to `components/toastStore.ts`
- `useT` hook extracted to `i18n/useT.ts`
- Dashboard upcoming filter uses ISO string comparison

---

## v1.0.2 (2026-04-29)

### Added
- Test coverage raised from 78% to 92% (89 tests)
- Tests for `getHolidayName`, `getDaysInMonth`, `getFirstDayOfMonth`, `formatDateRange`, `formatDate`, `escapeCSV`
- CSV import edge cases: escaped quotes, English half-day headers, missing columns

---

## v1.0.1 (2026-04-29)

### Added
- Timestamp in export filename (`urlaub-2026_2026-04-29_1430.csv`)

### Fixed
- All vacation days now get red tint in month view (previously only the first day showed a label)
- Weekday/month name arrays returned via `tRaw()` to fix `.map is not a function` crash
- Missing `useT` import restored in YearView

---

## v1.0.0 (2026-04-28)

### Added
- Vacation planning with start/end date, optional note, work-day counting
- 30-day default budget (editable 1–60)
- 16 German states with correct public holidays via `feiertagejs`
- Half-day booking; Dec 24 and Dec 31 always count as 0.5
- Overlap prevention
- Multi-year work-day correctness
- Four views: Dashboard, Year Grid, Month Calendar, Sortable List
- Click-to-plan two-click date range selection in month view
- LocalStorage persistence
- CSV export (UTF-8 with BOM, semicolon-delimited) and import
- German & English translations
- Dark mode (light / dark / auto)
- School holidays striped overlay (2025–2026 data)
- Undo/redo (Ctrl+Z / Ctrl+Y) with toast notifications
- 67 tests
