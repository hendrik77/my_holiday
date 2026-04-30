# My Holiday — Urlaubsplaner

A vacation day planner for Germany. Plan your annual vacation days with automatic work-day calculation that excludes weekends and public holidays for your chosen state (Bundesland).

## Features

- **Configurable budget** — set your annual vacation allowance (default: 30 days)
- **Carry-over tracker** — enter days carried over from last year; Dashboard shows how many have been used, how many remain, and warns when the March 31 deadline approaches
- **All 16 German states** — select your Bundesland; public holidays computed via [`feiertagejs`](https://www.npmjs.com/package/feiertagejs)
- **Half-day booking** — mark single days as half days (0.5 instead of 1.0); Dec 24 and Dec 31 always count as 0.5
- **Smart work-day counting** — only counts Monday–Friday, excludes weekends and public holidays; periods spanning multiple years are correctly clipped to the selected year
- **Four views** — Dashboard summary, year grid (12 mini calendars), full month calendar, and a sortable list
- **Click-to-plan** — select date ranges directly in the month view; click existing vacations to edit or delete
- **Live work-day preview** — the add/edit modal shows exactly how many work days a date range consumes
- **Overlap prevention** — prevents booking a vacation that conflicts with an existing one
- **CSV import/export** — backup your data or edit it in Excel; semicolon-delimited UTF-8 with BOM
- **Dark mode** — light, dark, or auto (follows system preference)
- **English & German** — switch language in settings, all UI translated
- **School holidays** — subtle overlay showing school breaks for your state
- **Undo/redo** — Ctrl+Z / Ctrl+Y or toast notification with undo button
- **Persistent storage** — all data saved to your browser's `localStorage`, no backend required
- **Responsive** — works on desktop, tablet, and mobile

## How to Use

### Starting the app

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Running tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

Tests follow the RED-GREEN principle — see [`RULES.md`](./RULES.md).

### Views

| Tab | What it does |
|---|---|
| **Übersicht** | Summary cards (used, remaining, total days), progress bar, carry-over tracker, list of upcoming vacations — click any upcoming entry to edit it |
| **Jahresansicht** | 12 mini month calendars. Full vacation days are filled red, half days have a striped pattern. Public holidays in red text. Click any month to jump to its detail view. |
| **Monatsansicht** | Full-size calendar for a single month. Navigate with `‹` `›` arrows. Public holidays are labeled. |
| **Liste** | Table of all planned vacations with date range, work-day count, note, and edit/delete buttons. |

### Settings

Click the ⚙️ gear icon in the navigation bar to open settings:

- **Urlaubstage pro Jahr** — set your annual vacation budget (1–60, default: 30)
- **Übertrag vom Vorjahr** — auto-calculated when switching years (unused days from the previous year); can be overridden manually (0–60); see [Carry-over tracker](#carry-over-tracker) below
- **Bundesland** — choose your state to get the correct public holidays (default: Hessen)

### Adding a vacation

1. Click **+ Urlaub planen** (on Dashboard or List view), or
2. In **Monatsansicht**, click a start date, then click an end date — the modal opens with the range pre-filled
3. Enter an optional note (e.g. "Sommerurlaub")
4. Toggle **Halber Tag** for single-day bookings (e.g. a doctor's appointment)
5. The modal shows the live work-day count
6. Click **Urlaub planen** to save

The modal prevents booking a vacation that overlaps with an existing one — an error message is shown if the date range conflicts.

### Half-day rules

| Rule | Counts as |
|------|-----------|
| User-toggled "Halber Tag" (single day only) | 0.5 |
| December 24 (Christmas Eve) | 0.5 |
| December 31 (New Year's Eve) | 0.5 |
| Normal work day | 1.0 |
| Weekend or public holiday | 0 |

Half-day toggles are disabled for multi-day ranges. When toggling half-day on with a multi-day selection, the end date auto-collapses to match the start date.

### Editing or deleting

- Click any upcoming vacation on the **Dashboard** to open the edit modal directly
- Click any existing vacation block in the **month view** to open the edit modal
- Use the ✎ (edit) and ✕ (delete) buttons in the **list view** or in the month view's vacation list
- All changes persist automatically

### Carry-over tracker

In Germany, unused vacation days can typically be carried over into the new year but must be used by **March 31** (this is the statutory default; some contracts allow until June 30 — the app uses March 31).

**Automatic calculation:** when you navigate to a new year (e.g. 2026 → 2027), the app automatically computes carry-over as `max(0, annual budget − days used in the previous year)`. If you had no vacation data for the previous year the carry-over defaults to 0.

**Manual override:** open **Settings** (⚙️) and edit the **Übertrag vom Vorjahr** field (0–60). The override persists until you switch years again.

Once set, the Dashboard shows a carry-over card below the main progress bar:

- Progress bar: how many carry-over days have been consumed (vacations booked on or before March 31 count against carry-over first)
- Remaining days and deadline date
- **Warning** — if carry-over days are still unused and March 31 is ≤30 days away
- **Expired** — if March 31 has passed with unused carry-over days (displayed in red)

Carry-over days are "used first": work days from vacations before the deadline reduce the carry-over bucket before touching your regular annual budget.

### Changing years

Use the `‹ 2026 ›` arrows in the navigation bar. Data is stored per year — switch back and forth without losing plans.

### Import / Export

- **📤 Export** — downloads a CSV file (`urlaub-2026.csv`) with columns: `Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage`
- **📥 Import** — reads a CSV file (semicolon-delimited, UTF-8). Accepts `YYYY-MM-DD`, `DD.MM.YYYY`, and `MM/DD/YYYY` date formats. Replaces all existing periods after confirmation.
- The `Arbeitstage` column is computed on export for reference but ignored on import (work days are always derived from the date range).

### Public holidays

The app uses the [`feiertagejs`](https://www.npmjs.com/package/feiertagejs) library to compute public holidays for all 16 German states. Each state has its own set:

| State | Extra holidays (beyond the 9 nationwide) |
|-------|------------------------------------------|
| Baden-Württemberg | Heilige Drei Könige, Fronleichnam, Allerheiligen |
| Bayern | Heilige Drei Könige, Fronleichnam, Mariä Himmelfahrt, Allerheiligen |
| Berlin | Internationaler Frauentag |
| Brandenburg | Reformationstag |
| Bremen | Reformationstag |
| Hamburg | Reformationstag |
| Hessen | Fronleichnam |
| Mecklenburg-Vorpommern | Reformationstag |
| Niedersachsen | Reformationstag |
| Nordrhein-Westfalen | Fronleichnam, Allerheiligen |
| Rheinland-Pfalz | Fronleichnam, Allerheiligen |
| Saarland | Fronleichnam, Mariä Himmelfahrt, Allerheiligen |
| Sachsen | Reformationstag, Buß- und Bettag |
| Sachsen-Anhalt | Heilige Drei Könige, Reformationstag |
| Schleswig-Holstein | Reformationstag |
| Thüringen | Weltkindertag, Reformationstag |

Nationwide holidays (all states): Neujahr, Karfreitag, Ostermontag, Tag der Arbeit, Christi Himmelfahrt, Pfingstmontag, Tag der Deutschen Einheit, 1. Weihnachtstag, 2. Weihnachtstag.

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand (with `persist` middleware for localStorage) |
| Holidays | [`feiertagejs`](https://www.npmjs.com/package/feiertagejs) — zero-dependency German holiday computation |
| Styling | Plain CSS with custom properties (no runtime CSS-in-JS) |
| Routing | None — single-page with tab-based view switching |

### Project Structure

```
src/
├── types.ts                   # Shared TypeScript interfaces
├── data/
│   └── holidays.ts            # feiertagejs wrapper + GermanState type + state list
├── utils/
│   ├── calendar.ts            # Work-day counting, half-day logic, date formatting
│   └── export.ts              # CSV export/import (handwritten parser, no deps)
├── state/
│   └── store.ts               # Zustand store (state + actions, persisted to localStorage)
├── components/
│   ├── Nav.tsx                # Top navigation (view tabs, year selector, import/export, settings)
│   ├── Dashboard.tsx          # Overview: stats cards, progress bar, upcoming vacations
│   ├── YearView.tsx           # 12-month grid with mini calendars
│   ├── MonthView.tsx          # Full month calendar with click-to-select and inline editing
│   ├── ListView.tsx           # Sortable table of all vacation periods
│   ├── VacationModal.tsx      # Add/edit form with date pickers, half-day toggle, live preview
│   └── SettingsModal.tsx      # Settings: state selection + editable vacation day budget
├── App.tsx                    # Root component — renders active view based on state
├── App.css                    # All component styles (single stylesheet, BEM-like naming)
├── index.css                  # Design tokens (CSS custom properties) and global reset
└── main.tsx                   # React entry point
```

### Data Model

```typescript
VacationPeriod {
  id: string;          // Unique ID (generated)
  startDate: string;   // ISO date YYYY-MM-DD
  endDate: string;     // ISO date YYYY-MM-DD
  note: string;        // Optional label
  halfDay?: boolean;   // Single-day half-day booking (Dec 24/31 always count as 0.5)
}

// State (persisted)
{
  year: number;              // Currently selected year
  totalDays: number;         // Annual vacation budget (default: 30, editable in settings)
  carryOverDays: number;     // Days carried over from previous year (default: 0, deadline: March 31)
  state: GermanState;        // Bundesland code (default: 'HE' for Hessen)
  periods: VacationPeriod[]; // All planned vacations
  view: 'dashboard' | 'year' | 'month' | 'list';
  selectedMonth: number;     // 0–11, active month in month view
}
```

### State Flow

- **Zustand store** is the single source of truth
- The `persist` middleware syncs the entire state to `localStorage` under the key `my-holiday-storage`
- All mutations go through store actions: `addPeriod`, `updatePeriod`, `removePeriod`, `importData`, `setState`, `setTotalDays`, `setCarryOverDays`
- Work-day counts are **derived** (computed on render, not stored) — this guarantees they stay correct even if the holiday data or counting logic changes
- Vacation day coverage is computed as `Set<string>` of ISO date strings for fast lookup in calendar views

### Key Design Decisions

**1. Work-day counting is always live-computed**

Work days are never stored. `countVacationWorkDays(period, state)` iterates day-by-day, applying weights:
- 1.0 for normal work days
- 0.5 for user-toggled half days (single-day only)
- 0.5 for Dec 24 and Dec 31 (always, regardless of user toggle)
- 0 for weekends and public holidays

This ensures correctness even if the app is updated with new logic later.

**2. No backend — pure client-side**

The app has no server component. All data lives in `localStorage`. This keeps deployment trivial (static HTML/JS/CSS) and works offline.

**3. Single CSS file with design tokens**

All styles live in `App.css`. The design system from `DESIGN.md` is implemented as CSS custom properties in `index.css`:

| Token | Value |
|---|---|
| `--color-primary` | `#db001b` |
| `--color-bg` | `#ffffff` |
| `--color-text` | `#151f27` |
| `--color-text-secondary` | `#586674` |
| `--color-border` | `#f4f8fc` |
| `--spacing-unit` | `20px` |
| `--radius` | `6px` |

No runtime CSS-in-JS library is used — this keeps the bundle small.

**4. View switching without a router**

Four views share the same URL. The active view is a piece of Zustand state (`view`). This avoids routing complexity for what is essentially a single-screen tool, and makes view state survive page reloads (since it's persisted).

**5. Click-to-select in month view**

Instead of a traditional date range picker, the month view uses a two-click flow:
1. Click a day → selection mode activates (hint banner appears)
2. Click another day → modal opens with the range pre-filled

Clicking an existing vacation block opens the edit modal directly. This keeps vacation planning fast and visual.

**6. feiertagejs for holiday computation**

All public holidays are computed via [`feiertagejs`](https://www.npmjs.com/package/feiertagejs), a zero-dependency TypeScript library that handles all 16 German states with their specific holidays, movable Easter-dependent dates, and even region-specific holidays (e.g. Augsburger Friedensfest).

**7. CSV import/export with handwritten parser**

CSV files use UTF-8 with BOM for correct Excel handling, semicolons as delimiters (German Excel convention), and support flexible date formats on import (`YYYY-MM-DD`, `DD.MM.YYYY`, `MM/DD/YYYY`). The parser is handwritten (~80 lines) — no library dependency.

**8. Vacation period display**

- Full vacation days are highlighted with a solid `--color-primary` background
- Half-day vacations show a diagonal stripe pattern in the year view and a `(½)` suffix in lists
- In the month view, only the **first day** of a multi-day vacation shows the note label (prevents visual clutter)
- Year view mini calendars show all vacation days as filled squares — weekends within a vacation period are included visually, but not counted

## Design System

This project follows the design system documented in [`DESIGN.md`](./DESIGN.md), automatically extracted from the Syskoplan Reply website:

- **Background**: `#ffffff` — light, clean canvas
- **Primary accent**: `#db001b` — used for CTAs, active states, progress bars, and vacation highlights
- **Text**: `#151f27` (headings and body)
- **Secondary text**: `#586674` (captions, muted elements)
- **Borders**: `#f4f8fc` (subtle dividers)
- **Spacing**: based on a `20px` grid unit
- **Border radius**: `6px` on interactive elements
- **Shadows**: mid-level (`0px 2px 10px -3px`) for cards, high-level (`0px 0px 18px 0px`) for modals
- **Typography**: system sans-serif stack with weight 500 for headings

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| > 1024px | Full desktop layout: 4-column year grid, 3-column stats |
| 640–1024px | Tablet: 3-column year grid, 2-column stats |
| < 640px | Mobile: 2-column year grid, single-column stats, stacked nav, reduced font sizes |
