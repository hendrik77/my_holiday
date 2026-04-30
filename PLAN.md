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
| SP-2 | **Pro-rata & leave-reduction utilities** (TDD) — `computeProRataEntitlement`, `countFullCalendarMonths`, `computeLeaveReduction` | 🔲 Pending |
| SP-3 | **ICS generation utility** (TDD) — RFC 5545 `.ics` file generator | 🔲 Pending |
| SP-4 | **VISION.md** — long-term roadmap document | ✅ Done |
| SP-5 | **Backend: Express + SQLite** — REST API, `periods` + `settings` tables, `changed_at` tracking | 🔲 Pending |
| SP-6 | **Migration script** — standalone `scripts/migrate-v1.ts`, v1 CSV → v2 SQLite | 🔲 Pending |
| SP-7 | **First-run wizard + employment dates** — onboarding modal, settings fields | 🔲 Pending |
| SP-8 | **Vacation types UI** — type selector in modal, colour badges, budget rules | 🔲 Pending |
| SP-9 | **iCal export** — Nav button + server endpoint | 🔲 Pending |
| SP-10 | **Frontend API wiring** — replace Zustand persist + localStorage with TanStack Query + REST | 🔲 Pending |
| SP-11 | **README + CHANGELOG** — document all v2 features | 🔲 Pending |

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
Phase 1 (parallel):  SP-1 ✅  SP-2  SP-3  SP-4 ✅
Phase 2 (after SP-1): SP-5  SP-6
Phase 3 (after SP-1 + SP-2 + SP-5): SP-7  SP-8
Phase 4 (after SP-3 + SP-5 + SP-8): SP-9
Phase 5 (all complete): SP-10  SP-11
```

### Running v2 (once SP-5 is done)

```bash
npm run dev          # starts frontend :5173 + API server :3001
npm run build        # compiles frontend + server
npm test             # vitest unit tests
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
