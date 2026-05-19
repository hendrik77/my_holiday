# Changelog

All notable changes to My Holiday.

---

## v2.1.1 (2026-05-19)

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
