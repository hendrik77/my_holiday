# Changelog

All notable changes to My Holiday.

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
