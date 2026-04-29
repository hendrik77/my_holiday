# Changelog

All notable changes to My Holiday.

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
- **CSV export** — UTF-8 with BOM, semicolon-delimited, Excel-compatible; filename includes timestamp
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
- **Test suite** — 67 tests covering calendar logic, CSV parsing, translations, holidays

### Bug Fixes
- **Vacation day highlighting** — all vacation days now get a red tint background in month view (was only first day)
- **i18n arrays** — weekday and month name arrays correctly handled via `tRaw()` (was breaking with `.map()`)
- **Missing import** — `useT` import restored in YearView after school holidays feature

### Dependencies
- React 19, TypeScript, Vite, Zustand (with persist)
- `feiertagejs` — German public holidays for all 16 states
- `vitest` — test runner

---

*First release — feature-complete vacation planner for Germany.*
