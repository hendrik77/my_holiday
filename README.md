# My Holiday — Urlaubsplaner

A vacation day planner for Germany. Plan your annual vacation days with automatic work-day calculation that excludes weekends and public holidays for your chosen state (Bundesland).

> **Security notice:** My Holiday has **no built-in authentication**. It is designed for single-user, localhost or home-network use only. Do not expose it to the internet without placing an authenticating reverse proxy (e.g. nginx + HTTP Basic Auth, Authelia, or similar) in front of it.

## Setup

```bash
npm install

# Start the backend (Express + SQLite, port 3001)
npm run server

# Start the frontend (Vite dev server, port 5173)
npm run dev
```

The frontend talks to the backend via REST API. Both must be running.

### Configuration

The backend reads these environment variables on startup:

| Variable | Default | Purpose |
|---|---|---|
| `API_HOST` | `127.0.0.1` | Network interface to bind. Loopback by default — the API is **not** reachable from other devices on your LAN. Set to `0.0.0.0` to expose on all interfaces (only do this if you've added authentication). |
| `API_PORT` | `3001` | TCP port |
| `DB_PATH` | `data/my-holiday.db` | SQLite database file path |
| `CORS_ORIGIN` | reflect any origin | Restrict cross-origin access in production, e.g. `CORS_ORIGIN=http://localhost:5173` |

Example — expose to LAN with a custom port:

```bash
API_HOST=0.0.0.0 API_PORT=4000 npm run server
```

## Docker

The easiest way to run the app on a server, NAS, or Raspberry Pi.

```bash
# Build and start (data persisted in ./data/)
docker-compose up

# Or without Compose
docker build -t my-holiday .
mkdir -p data
docker run -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -e DB_PATH=/app/data/my-holiday.db \
  -e API_HOST=0.0.0.0 \
  my-holiday
```

Open **http://localhost:3001** — the container serves both the frontend and the API on a single port.

The SQLite database is stored in `./data/my-holiday.db` on the host. Removing and recreating the container leaves your data intact.

## Running tests

```bash
npm test              # unit + integration tests (221 tests)
npm run test:watch    # watch mode
npm run test:e2e      # Playwright end-to-end smoke tests
```

Tests follow the RED-GREEN principle.

## Features

- **Configurable budget** — set your annual vacation allowance (default: 30 days)
- **Carry-over tracker** — enter days carried over from last year; Dashboard shows usage, warnings when the March 31 deadline approaches
- **First-run wizard** — onboarding collects employment dates, Bundesland, vacation days, and carry-over policy
- **All 16 German states** — select your Bundesland; public holidays computed via [`feiertagejs`](https://www.npmjs.com/package/feiertagejs)
- **8 vacation types** — Urlaub, Bildungsurlaub, Kur, Sabbatical, unbezahlter Urlaub, Mutterschutz, Elternzeit, Sonderurlaub with colour-coded badges and separate Bildungsurlaub budget
- **Half-day booking** — mark single days as half days (0.5); Dec 24 and Dec 31 always count as 0.5
- **Smart work-day counting** — only Monday–Friday, excludes weekends and public holidays; multi-year periods are correctly clipped
- **Four views** — Dashboard summary, year grid (12 mini calendars), full month calendar, sortable list
- **Click-to-plan** — select date ranges directly in the month view; click existing vacations to edit or delete
- **Live work-day preview** — modal shows exactly how many work days a date range consumes
- **Overlap prevention** — prevents booking conflicting vacations
- **CSV import/export** — backup your data or edit it in Excel; semicolon-delimited UTF-8 with BOM
- **iCal export** — downloadable `.ics` files for calendar apps (Apple Calendar, Outlook, Google Calendar)
- **Dark mode** — light, dark, or auto (follows system preference)
- **English & German** — switch language in settings
- **School holidays** — overlay showing school breaks for your state (fetched from ferien-api.de)
- **Responsive** — works on desktop, tablet, and mobile

## How to Use

### Views

| Tab | What it does |
|---|---|
| **Übersicht** | Summary cards (used, remaining, total days), progress bar, carry-over tracker, Bildungsurlaub counter, upcoming vacations — click any entry to edit |
| **Jahresansicht** | 12 mini month calendars. Vacation days are filled red, half days have a striped pattern, public holidays in red text. Click a month to jump to its detail view |
| **Monatsansicht** | Full-size calendar for a single month. Navigate with `‹` `›` arrows. Public holidays labeled, school holidays shown with stripes |
| **Liste** | Sortable table of all vacation periods with date range, work-day count, note, type badge, and edit/delete buttons |

### Settings

Click the ⚙️ gear icon to open settings:

- **Urlaubstage pro Jahr** — annual budget (1–60, default: 30)
- **Übertrag vom Vorjahr** — carry-over days; auto-calculated on year switch, manually overridable (0–60)
- **Bundesland** — determines public holidays for your region (default: Hessen)
- **Farbschema** — light, dark, or auto
- **Sprache** — Deutsch or English

### Adding a vacation

1. Click **+ Urlaub planen** (Dashboard or List view), or in **Monatsansicht** click a start date then an end date
2. Enter an optional note (e.g. "Sommerurlaub")
3. Choose a **vacation type** from the dropdown (default: Urlaub)
4. Toggle **Halber Tag** for single-day bookings
5. The modal shows the live work-day count; overlapping vacations are blocked
6. Click **Urlaub planen** to save

### Vacation types

| Type | Budget impact |
|------|--------------|
| `urlaub` | Consumes main vacation budget |
| `bildungsurlaub` | Separate counter (must be enabled in settings) |
| `kur`, `sabbatical`, `mutterschaftsurlaub`, `sonderurlaub` | Informational only |
| `unbezahlterUrlaub`, `elternzeit` | Reduces vacation entitlement (§ 17 BUrlG) |

### Half-day rules

| Rule | Counts as |
|------|-----------|
| User-toggled "Halber Tag" (single day only) | 0.5 |
| December 24 (Christmas Eve) | 0.5 |
| December 31 (New Year's Eve) | 0.5 |
| Normal work day | 1.0 |
| Weekend or public holiday | 0 |

### Carry-over tracker

Carry-over days from the previous year must be used by **March 31** (some contracts allow June 30 — configurable in the first-run wizard).

**Automatic calculation:** switching years computes carry-over as `max(0, annual budget − days used in previous year)`.

**Dashboard:** progress bar shows consumed vs. remaining carry-over days, with:
- ⚠️ **Warning** — ≤30 days until deadline with unused days
- ❌ **Expired** — deadline passed with unused days (shown in red)

Carry-over days are "used first": vacations before March 31 consume the carry-over bucket before the regular budget.

### Editing or deleting

- Click any upcoming vacation on the **Dashboard** to open the edit modal
- Click any vacation block in the **month view** to edit
- Use ✎ (edit) and ✕ (delete) buttons in the **list view** or month view's vacation list
- All changes persist to the database immediately

### Changing years

Use the `‹ 2026 ›` arrows in the navigation bar. Data is stored per year — switch freely without losing plans.

### Import / Export

- **📤 Export** — downloads `urlaub-2026.csv` with columns: `Startdatum;Enddatum;Notiz;Halber Tag;Arbeitstage`
- **📥 Import** — reads CSV (semicolon-delimited, UTF-8). Accepts `YYYY-MM-DD`, `DD.MM.YYYY`, and `MM/DD/YYYY` date formats
- **📅 iCal** — downloads `urlaub-2026.ics` for import into calendar apps
- The `Arbeitstage` column is for reference only — work days are always computed from the date range

### Public holidays

Computed via [`feiertagejs`](https://www.npmjs.com/package/feiertagejs) for all 16 German states:

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

### Migrating from v1

If you used v1 (pure client-side with localStorage), export your data as CSV first, then:

```bash
npx tsx scripts/migrate-v1.ts ./urlaub-2026.csv
```

The migration is **idempotent** — running it twice won't create duplicates.

## Architecture (v2)

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| State | Zustand (UI state: view, year, theme, language) |
| Data | TanStack Query + REST API |
| Backend | Express + better-sqlite3 (SQLite, port 3001) |
| Holidays | `feiertagejs` (public holidays) + ferien-api.de (school holidays) |
| Styling | Plain CSS with custom properties, per-component CSS files |
| Routing | None — tab-based view switching |
| Tests | Vitest (unit/integration) + Playwright (E2E) |

### Project Structure

```
src/
├── types.ts                   # Shared TypeScript interfaces
├── api/
│   ├── client.ts              # REST API fetch wrappers
│   └── hooks.ts               # TanStack Query hooks
├── data/
│   ├── holidays.ts            # feiertagejs wrapper + GermanState
│   └── schoolHolidays.ts      # Dynamic school holidays (ferien-api.de)
├── utils/
│   ├── calendar.ts            # Work-day counting, half-day logic
│   ├── entitlement.ts         # Pro-rata entitlement & leave reduction (§ 4/§ 17 BUrlG)
│   ├── export.ts              # CSV export/import (handwritten parser)
│   └── ics.ts                 # RFC 5545 iCalendar generator
├── state/
│   └── store.ts               # Zustand store (UI-only: view, year, theme, language, undo/redo)
├── components/
│   ├── Nav.tsx                # Navigation + import/export + settings
│   ├── Dashboard.tsx          # Stats, progress bars, upcoming list
│   ├── YearView.tsx           # 12-month grid with mini calendars
│   ├── MonthView.tsx          # Full calendar with click-to-select
│   ├── ListView.tsx           # Sortable table of all periods
│   ├── VacationModal.tsx      # Add/edit form with type selector
│   ├── SettingsModal.tsx      # Settings: state, days, theme, language
│   ├── FirstRunWizard.tsx     # 4-step onboarding modal
│   └── Toast.tsx              # Undo notifications
├── App.tsx                    # Root component + theme management
├── App.css                    # Layout + responsive styles only
├── index.css                  # Design tokens + global reset
└── main.tsx                   # Entry point (QueryClientProvider + I18nProvider)

server/
├── index.ts                   # Express server (port 3001)
├── routes.ts                  # REST routes + ICS endpoint
├── db.ts                      # SQLite schema + CRUD operations
└── types.ts                   # Server-specific types

scripts/
└── migrate-v1.ts              # v1 CSV → v2 SQLite (idempotent)

e2e/
└── smoke.spec.ts              # Playwright E2E smoke tests
```

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/periods?year=YYYY` | List periods for a year |
| `POST` | `/api/v1/periods` | Create a vacation period |
| `PUT` | `/api/v1/periods/:id` | Update a period |
| `DELETE` | `/api/v1/periods/:id` | Delete a period |
| `GET` | `/api/v1/settings` | Get all settings |
| `PUT` | `/api/v1/settings` | Update settings |
| `GET` | `/api/v1/export.ics?year=YYYY` | Download iCalendar file |

All data is persisted to `data/my-holiday.db` (SQLite, gitignored).

### Data Model

```typescript
VacationType = 'urlaub' | 'bildungsurlaub' | 'kur' | 'sabbatical'
  | 'unbezahlterUrlaub' | 'mutterschaftsurlaub' | 'elternzeit' | 'sonderurlaub'

VacationPeriod {
  id: string;          // UUID (crypto.randomUUID())
  startDate: string;   // ISO date YYYY-MM-DD
  endDate: string;     // ISO date YYYY-MM-DD
  note: string;
  halfDay?: boolean;   // Single-day half-day booking
  type?: VacationType; // Defaults to 'urlaub'
  changedAt: string;   // ISO timestamp, updated on every edit
}
```

### State Flow

- **TanStack Query** manages server state: periods and settings are fetched from and mutated via the REST API
- **Zustand** manages local UI state: active view, selected year/month, theme, language, undo/redo stacks
- TanStack Query automatically invalidates and refetches period/setting queries after mutations
- Work-day counts are **derived** (computed on render) — never stored, guaranteeing correctness

### Key Design Decisions

**1. Server-backed persistence**

All vacation data and settings are stored in a local SQLite database. The Express backend exposes a REST API consumed by the frontend via TanStack Query. No localStorage, no manual sync.

**2. Work-day counting is live-computed**

`countVacationWorkDays()` iterates day-by-day applying weights: 1.0 for normal work days, 0.5 for user half-days, 0.5 for Dec 24/31, 0 for weekends and holidays. Never stored — always correct.

**3. Per-component CSS files**

Styles are split into co-located CSS files (`Nav.css`, `Dashboard.css`, `Calendar.css`, etc.). Design tokens live in `index.css`. No CSS-in-JS — keeps the bundle small.

**4. View switching without a router**

Four views share one URL. The active view is in Zustand state. No routing complexity for a single-screen tool.

**5. Pro-rata vacation entitlement (§ 4 BUrlG)**

Full entitlement after 6 complete months of employment in a year; otherwise 1/12 per complete month worked. Leave reductions (§ 17) apply for unpaid leave and parental leave.

**6. Idempotent CSV migration**

The migration script (`scripts/migrate-v1.ts`) matches periods by composite key `(startDate, endDate, note, halfDay, type)`. Rerunning safely skips existing records.

## Design System

Documented in [`DESIGN.md`](./DESIGN.md), based on the Syskoplan Reply website:

| Token | Value |
|---|---|
| `--color-primary` | `#db001b` |
| `--color-bg` | `#ffffff` |
| `--color-text` | `#151f27` |
| `--color-text-secondary` | `#586674` |
| `--color-border` | `#f4f8fc` |
| `--spacing-unit` | `20px` |
| `--radius` | `6px` |

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| > 1024px | Full desktop: 4-column year grid, 3-column stats |
| 640–1024px | Tablet: 3-column year grid, 2-column stats |
| < 640px | Mobile: 2-column year grid, single-column stats, stacked nav |

## Development Plan

See [`PLAN.md`](./PLAN.md) for the full v2 roadmap and [`VISION.md`](./VISION.md) for the long-term vision.
