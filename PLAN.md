# My Holiday — Development Plan

> Current release: **v1.x** (branch: `main`)
> In development: **v2** (branch: `v2-development`)
> Long-term roadmap: see [VISION.md](./VISION.md)

---

## Version 2

Version 2 adds a real backend, richer data model, and several long-requested features while keeping the same single-user, locally-hosted design.

### Goals

| # | Feature | Status |
|---|---------|--------|
| SP-1 | **Type definitions + i18n** — `VacationType`, employment fields, all new translation strings | ✅ Done |
| SP-2 | **Pro-rata & leave-reduction utilities** (TDD) — `computeProRataEntitlement`, `countFullCalendarMonths`, `computeLeaveReduction` | ✅ Done |
| SP-3 | **ICS generation utility** (TDD) — RFC 5545 `.ics` file generator | ✅ Done |
| SP-4 | **VISION.md** — long-term roadmap document | ✅ Done |
| SP-5 | **Backend: Express + SQLite** — REST API, `periods` + `settings` tables, `changed_at` tracking, API tests | ✅ Done |
| SP-6 | **Migration script** — standalone `scripts/migrate-v1.ts`, v1 CSV → v2 SQLite, idempotency tests | ✅ Done |
| SP-7 | **First-run wizard + employment dates** — onboarding modal, settings fields | ✅ Done |
| SP-8 | **Vacation types UI** — type selector in modal, colour badges, budget rules | ✅ Done |
| SP-9 | **iCal export** — Nav button + server endpoint | ✅ Done |
| SP-10 | **Frontend API wiring** — replace Zustand persist + localStorage with TanStack Query + REST; component-level integration tests | ✅ Done |
| SP-11 | **README + CHANGELOG** — document all v2 features | ✅ Done |
| SP-12 | **English i18n backfill** — add missing `firstRun`, `employment`, `carryOverPolicy`, `leaveReduction`, `bildungsUrlaub` keys to `en` translations | ✅ Done |
| SP-13 | **End-to-end smoke tests** — Playwright tests for critical paths: first-run wizard → plan → export → settings | ✅ Done |
| SP-14 | **Dynamic school holidays** — replace hardcoded `src/data/schoolHolidays.ts` (2025–2026 only) with a library or API that fetches school holiday data for the selected Bundesland for any year | ✅ Done |
| SP-15 | **Component-level tests** — React Testing Library tests for all components (Dashboard, MonthView, ListView, Nav, VacationModal, SettingsModal) covering render states, user interactions, and edge cases | ✅ Done |
| SP-16 | **Refactor App.css** — split single ~900-line `App.css` into per-component CSS modules or co-located `.css` files; keep design tokens in `index.css` | ✅ Done |

### Key Design Decisions

**Persistence** — Node/Express + `better-sqlite3`. SQLite file at `data/my-holiday.db` (gitignored). Periods table gains `changed_at` (updated on every edit) and `type` column. All IDs are UUIDs (`crypto.randomUUID()`).

**Migration** — No in-app migration. Separate CLI script: `npx tsx scripts/migrate-v1.ts ./urlaub-2026.csv`. Re-runnable (idempotent).

**Employment dates + pro-rata** — `employmentStartDate` / `employmentEndDate` stored in settings. App auto-calculates pro-rata vacation entitlement (§ 4 BUrlG): full entitlement after 6 months, else 1/12 per complete month worked.

**Leave reductions** — Unpaid leave (§ 17 BUrlG) and parental leave (§ 17 BEEG) reduce entitlement by 1/12 per **full calendar month** of leave. Partial months never combine.

**Vacation types** — 8 types: `urlaub`, `bildungsurlaub`, `kur`, `sabbatical`, `unbezahlterUrlaub`, `mutterschaftsurlaub`, `elternzeit`, `sonderurlaub`. Only `urlaub` consumes the main budget. `bildungsurlaub` has its own counter (default 0, must be enabled in settings). All other types are informational / affect entitlement calculation.

**First-run wizard** — Shown once on clean install. Collects: employment start date, Bundesland, annual vacation days, carry-over policy.

**iCal export** — Client-side `.ics` generation (RFC 5545). Also available as `GET /api/v1/export.ics?year=YYYY` for future calendar subscription.

### Dependency Order

```
Phase 0 (fix):       SP-12 (English i18n — blocks SP-7/SP-8 rendering in en)
Phase 1 (parallel):  SP-1 ✅  SP-2 ✅  SP-3 ✅  SP-4 ✅
Phase 2 (after SP-12): SP-5 ✅  SP-6 ✅
Phase 3 (after SP-2 + SP-5 + SP-12): SP-7 ✅  SP-8 ✅
Phase 4 (after SP-3 + SP-5 + SP-8): SP-9 ✅
Phase 5 (all complete): SP-10 ✅  SP-11 ✅  SP-13 ✅
Phase 6 (independent): SP-14 ✅  SP-15 ✅  SP-16 ✅
```

### Risk Mitigations

| Risk | Mitigation | Task |
|------|-----------|------|
| SP-1 marked done but English i18n is missing 5 key sections — v2 UI would crash in English mode | Backfill `en` translation keys before any UI work that references them | **SP-12** |
| SP-5 backend has no test plan — REST API could regress silently | `supertest`-based API tests covering all CRUD endpoints, error paths, and the ICS export route; run as part of `npm test` | **SP-5** (embedded) |
| SP-6 migration has no idempotency or error-path coverage | Unit tests: re-running migration on the same CSV → no duplicates; missing columns → clear error; empty file → empty DB; corrupt dates → skip with warnings | **SP-6** (embedded) |
| SP-10 touches every component — replacing Zustand with TanStack Query is the largest single change in v2 | Component-level integration tests with mocked API responses (via `msw`); test each view in loading, empty, error, and happy states before wiring production API | **SP-10** (embedded) |
| No end-to-end validation across backend + frontend | Playwright smoke tests: (1) first-run wizard completes, (2) plan a vacation → appears on dashboard, (3) export ICS → import into calendar app, (4) settings round-trip | **SP-13** |

### Running v2 (once SP-5 is done)

```bash
npm run dev          # starts frontend :5173 + API server :3001
npm run build        # compiles frontend + server
npm test             # vitest unit + API tests
npm run test:e2e     # Playwright end-to-end tests
npx tsx scripts/migrate-v1.ts ./urlaub-2026.csv   # one-time migration
```

---

## Version 1 (current stable)

Pure client-side React + TypeScript + Vite. All data in `localStorage` via Zustand persist middleware. See [README.md](./README.md) for full documentation.

### v1 Changelog highlights
- **1.0.4** — Carry-over tracker with auto-calculation on year switch; click-to-edit on Dashboard
- **1.0.3** — Review fixes: missing HE state, broken imports, dead theme picker, react-hooks compliance
- **1.0.2** — Test coverage raised to 92% (89 tests)
- **1.0.1** — Timestamp in export filename; vacation day highlighting fix; i18n array fix
- **1.0.0** — Initial release
