# Changelog

All notable changes to My Holiday.

---

## 1.0.4 (2026-04-30)

### Added
- **Carry-over tracker** — enter days carried over from the previous year; auto-calculated on year switch (`max(0, budget − days used in previous year)`); Dashboard shows progress bar, deadline (March 31), expiry warning (≤30 days) and expired notice; manual override in settings
- **Click-to-edit on Dashboard** — clicking any upcoming vacation opens the edit modal directly, without switching views

---

## 1.0.3 (2026-04-29)

### Fixed
- **Build was broken** — `'HE'` (Hessen) was missing from the `GermanState` union despite being the default state and used throughout (~15 TS errors)
- **Broken imports** — `src/types.ts` used `'../'` paths from inside `src/`
- **Dead theme picker** — `SettingsModal` referenced undeclared `selectedTheme`/`setSelectedTheme`; the theme dropdown is now wired up
- **Crashing delete** — `ListView` delete handler called `showToast` without importing it
- **`setState`-in-effect in `VacationModal`** — replaced two effects with `handleStartDateChange` / `handleHalfDayToggle` event handlers
- **Missing `state` dep in `VacationModal` `workDays` useMemo** — switching Bundesland with the modal open showed stale work-day counts
- **CSV import respected `Halber Tag` on multi-day rows** — `halfDay` is now coerced to `false` unless start === end (matches the data invariant)

### Changed
- **Toast split** — module store extracted to `components/toastStore.ts`; `Toast.tsx` is now component-only (fast-refresh friendly)
- **i18n split** — `useT` hook + `I18nContext` extracted to `i18n/useT.ts`; `context.tsx` now exports only `I18nProvider`
- **Dashboard upcoming filter** — switched from `Date` arithmetic to ISO string compare (removes complex `useMemo` dep)
- ESLint config now ignores `coverage/`
- Dropped unused declarations: `CSV_HEADER`, `totalDays` parameter on `downloadCSV`, `NestedKeyOf`, `setView`, `isToday`/`todayStr`, `StateData`, `VacationPeriod`/`ViewType` re-imports

---

## 1.0.2 (2026-04-29)

### Added
- **Test coverage** — 89 tests, 92% coverage (up from 78% / 67 tests)
- Tests for `getHolidayName`, `getDaysInMonth`, `getFirstDayOfMonth`, `formatDateRange`, `formatDate`, `escapeCSV`
- CSV import edge cases: escaped quotes, English half-day headers, missing columns

---

## 1.0.1 (2026-04-29)

### Added
- **Timestamp in export filename** — exports now named `urlaub-2026_2026-04-29_1430.csv` to prevent overwrites

### Fixed
- **Vacation day highlighting** — all vacation days in month view now get a red tint background (previously only the first day showed a tiny label)
- **i18n arrays** — weekday and month name arrays now correctly returned via `tRaw()` instead of breaking with `.map is not a function`
- **Missing `useT` import** — restored in YearView after school holidays feature inadvertently dropped it

---

## 1.0.0 (2026-04-28)

### Core Features
- **Vacation planning** with start/end date, optional note, work-day counting
- **30-day default budget**, editable in settings (1–60)
- **16 German states** — select Bundesland for correct public holidays via `feiertagejs`
- **Half-day booking** — user toggle for single days (0.5 work days)
- **Auto half-days** — Dec 24 (Christmas Eve) and Dec 31 (New Year's Eve) always count as 0.5
- **Overlap prevention** — blocks booking a vacation that conflicts with an existing one
- **Multi-year correctness** — periods spanning years are correctly clipped to the selected year
- **Four views** — Dashboard, Year Grid, Month Calendar, Sortable List
- **Click-to-plan** — two-click date range selection in month view
- **LocalStorage persistence** — all data survives page reloads

### Import / Export
- **CSV export** — UTF-8 with BOM, semicolon-delimited, Excel-compatible
- **CSV import** — accepts ISO, German, and US date formats; flexible column mapping

### Internationalisation
- **German & English** — all UI strings translated, language persisted
- Language switch in settings

### Appearance
- **Dark mode** — light, dark, or auto (follows system `prefers-color-scheme`)
- Responsive layout (desktop, tablet, mobile)

### Other
- **School holidays** — striped overlay on calendar for the selected state (2025–2026 data)
- **Undo/redo** — Ctrl+Z / Ctrl+Y, toast notifications with undo button on delete
- **Overlap detection** — `hasOverlap()` prevents conflicting vacation bookings
- **Test suite** — 67 tests covering calendar logic, CSV parsing, translations, holidays

### Dependencies
- React 19, TypeScript, Vite, Zustand (with persist)
- `feiertagejs` — German public holidays for all 16 states
- `vitest` — test runner
