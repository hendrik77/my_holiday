# My Holiday — Urlaubsplaner

A vacation day planner for Germany (Hesse / Frankfurt am Main). Plan your 30 annual vacation days across the year with automatic work-day calculation that excludes weekends and all Hessian public holidays.

## Features

- **30-day budget** — tracks work-day usage against your annual vacation allowance
- **Smart work-day counting** — only counts Monday–Friday, automatically excludes all Hesse public holidays
- **Four views** — Dashboard summary, year grid (12 mini calendars), full month calendar, and a sortable list
- **Click-to-plan** — select date ranges directly in the month view; click existing vacations to edit or delete
- **Live work-day preview** — the add/edit modal shows exactly how many work days a date range consumes
- **Persistent storage** — all data saved to your browser's `localStorage`, no backend required
- **Responsive** — works on desktop, tablet, and mobile

## How to Use

### Starting the app

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Views

| Tab | What it does |
|---|---|
| **Übersicht** | Summary cards (used, remaining, total days), progress bar, list of upcoming vacations |
| **Jahresansicht** | 12 mini month calendars. Vacation days are highlighted in red, public holidays in red text. Click any month to jump to its detail view. |
| **Monatsansicht** | Full-size calendar for a single month. Navigate with `‹` `›` arrows. Public holidays are labeled. |
| **Liste** | Table of all planned vacations with date range, work-day count, note, and edit/delete buttons. |

### Adding a vacation

1. Click **+ Urlaub planen** (on Dashboard or List view), or
2. In **Monatsansicht**, click a start date, then click an end date — the modal opens with the range pre-filled
3. Enter an optional note (e.g. "Sommerurlaub")
4. The modal shows the live work-day count
5. Click **Urlaub planen** to save

### Editing or deleting

- Click any existing vacation block in the month view to open the edit modal
- Use the ✎ (edit) and ✕ (delete) buttons in the list view or in the month view's vacation list
- All changes persist automatically

### Changing years

Use the `‹ 2026 ›` arrows in the top-right of the navigation bar. Data is stored per year — switch back and forth without losing plans.

### Public holidays

The app computes all Hessian public holidays automatically:

| Holiday | Date rule |
|---|---|
| Neujahr | January 1 |
| Karfreitag | Easter Sunday − 2 days |
| Ostermontag | Easter Sunday + 1 day |
| Tag der Arbeit | May 1 |
| Christi Himmelfahrt | Easter Sunday + 39 days |
| Pfingstmontag | Easter Sunday + 50 days |
| Fronleichnam | Easter Sunday + 60 days |
| Tag der Deutschen Einheit | October 3 |
| 1. Weihnachtstag | December 25 |
| 2. Weihnachtstag | December 26 |

Easter is computed using the Anonymous Gregorian algorithm, so the app works for any year.

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand (with `persist` middleware for localStorage) |
| Styling | Plain CSS with custom properties (no runtime CSS-in-JS) |
| Routing | None — single-page with tab-based view switching |

### Project Structure

```
src/
├── types.ts                  # Shared TypeScript interfaces
├── data/
│   └── holidays.ts           # Easter algorithm + Hesse public holiday computation
├── utils/
│   └── calendar.ts           # Work-day counting, date formatting, calendar grid helpers
├── state/
│   └── store.ts              # Zustand store (state + actions, persisted to localStorage)
├── components/
│   ├── Nav.tsx               # Top navigation bar (view tabs + year selector)
│   ├── Dashboard.tsx         # Overview: stats cards, progress bar, upcoming vacations
│   ├── YearView.tsx          # 12-month grid with mini calendars
│   ├── MonthView.tsx         # Full month calendar with click-to-select and inline editing
│   ├── ListView.tsx          # Sortable table of all vacation periods
│   └── VacationModal.tsx     # Add/edit form with date pickers and work-day preview
├── App.tsx                   # Root component — renders active view based on state
├── App.css                   # All component styles (single stylesheet, BEM-like naming)
├── index.css                 # Design tokens (CSS custom properties) and global reset
└── main.tsx                  # React entry point
```

### Data Model

```typescript
VacationPeriod {
  id: string;          // Unique ID (generated)
  startDate: string;   // ISO date YYYY-MM-DD
  endDate: string;     // ISO date YYYY-MM-DD
  note: string;        // Optional label
}

// State (persisted)
{
  year: number;              // Currently selected year
  totalDays: number;         // Annual vacation budget (default: 30)
  periods: VacationPeriod[]; // All planned vacations
  view: 'dashboard' | 'year' | 'month' | 'list';
  selectedMonth: number;     // 0–11, active month in month view
}
```

### State Flow

- **Zustand store** is the single source of truth
- The `persist` middleware syncs the entire state to `localStorage` under the key `my-holiday-storage`
- All mutations go through store actions: `addPeriod`, `updatePeriod`, `removePeriod`
- Work-day counts are **derived** (computed on render, not stored) — this guarantees they stay correct even if holiday data or the counting logic changes
- Vacation day coverage is computed as `Set<string>` of ISO date strings for fast lookup in calendar views

### Key Design Decisions

**1. Work-day counting is always live-computed**

Work days are never stored. Every component calls `countWorkDays(start, end)` which iterates day-by-day, skipping weekends and public holidays. This ensures correctness even if the app is updated with new logic later.

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

No runtime CSS-in-JS library is used — this keeps the bundle small (~66 KB gzipped JS, ~2.6 KB gzipped CSS).

**4. View switching without a router**

Four views share the same URL. The active view is a piece of Zustand state (`view`). This avoids routing complexity for what is essentially a single-screen tool, and makes view state survive page reloads (since it's persisted).

**5. Click-to-select in month view**

Instead of a traditional date range picker, the month view uses a two-click flow:
1. Click a day → selection mode activates (hint banner appears)
2. Click another day → modal opens with the range pre-filled

Clicking an existing vacation block opens the edit modal directly. This keeps vacation planning fast and visual.

**6. Easter algorithm (not hardcoded dates)**

Holidays are computed, not looked up from a static table. The Anonymous Gregorian algorithm computes Easter for any year, and all movable holidays (Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag, Fronleichnam) are derived from it. Fixed-date holidays (Neujahr, Tag der Arbeit, etc.) are hardcoded. This means the app works correctly for any past or future year.

**7. Public holiday display**

- **Year view**: holiday dates appear in `--color-primary` (red) text in mini calendars
- **Month view**: each holiday date shows its full name as a small red label inside the day cell (e.g. "Karfreitag")
- Weekends are visually distinct (gray background in month view, muted text in year view)

**8. Vacation period display**

- Vacation days are highlighted with a solid `--color-primary` background
- In the month view, only the **first day** of a multi-day vacation shows the note label (prevents visual clutter)
- Year view mini calendars show all vacation days as filled red squares — weekends within a vacation period are included visually (they're part of your time off), but not counted toward the budget

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
