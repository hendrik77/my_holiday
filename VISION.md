# My Holiday — Long-term Vision

> This document describes future direction beyond the current release.
> For completed work see [CHANGELOG.md](./CHANGELOG.md).
> For current features see [README.md](./README.md).

---

## Overview

My Holiday starts as a personal vacation planner for German employees. The roadmap has five pillars:

1. **Personal Enhancements** — deeper planning tools for individual users (multi-year view, entitlement visualizer, printable plan)
2. **v3 Multi-user** — authentication and shared calendars for small teams and organisations
3. **v4 Company Planner** — approval workflows, staffing rules, and HR tooling for organisations
4. **AI / MCP / CLI** — natural language access, bridge day optimizer, and scripting for power users
5. **Family & Household** — multi-profile coordination for families managing school holidays and childcare

Each pillar can be shipped independently. The core principle throughout is preserving the simplicity that makes the personal version useful.

---

## Personal Enhancements

**Trigger:** current users want deeper personal planning tools without multi-user complexity.

These features improve the single-user experience and can ship independently of the multi-user roadmap.

### Multi-year planning view

A compact 2–3 year horizontal timeline so long periods — a Christmas break spanning two years or a sabbatical — can be planned without switching year views. Vacation blocks are colour-coded by type; clicking one opens the usual edit modal.

### Printable / shareable leave plan

Generate a clean one-page PDF or shareable link showing approved vacation dates for a given year — the kind of document HR or a manager asks for at the start of the year. The PDF mirrors the year grid view with a summary table of days used per type appended below.

### Entitlement timeline visualizer

A horizontal visual line showing key milestones for the current employee: start of employment → 6-month mark (full entitlement unlocks under § 4 BUrlG) → carry-over deadline → year end. The current accrual is highlighted. Especially useful for new hires figuring out exactly how many days they have earned.

---

## v3 Multi-user + Authentication

**Trigger:** organisation wants more than one person to use the app.

### Authentication
- OIDC / OAuth 2.0 against external Identity Providers: **Microsoft Entra ID**, **Authentik**, **Keycloak**
- JWT session tokens; refresh token rotation
- No passwords stored in the app — IdP owns credentials

### Data layer upgrade
- PostgreSQL replaces SQLite (connection pooling, concurrent writes, row-level security)
- Each user owns their own `periods` and `settings` rows
- Data migration path: SQLite → PostgreSQL via standard dump/restore

### User model
- User profile: name, email, team, role (`employee` / `manager` / `admin`)
- Manager view: read-only overlay of direct reports' vacation periods on shared calendar
- Privacy control: configurable per org — colleagues see dates only, or dates + notes, or nothing

---

## v4 Company Holiday Planner

**Trigger:** HR or team leads need to manage vacation across departments.

### Organisation model
- Hierarchy: **Company → Department → Team → User**
- Cross-cutting: **Project** memberships (a user can belong to multiple projects)
- Views: per-team calendar, per-project calendar, company-wide calendar

### Approval workflows
- Configurable per team: auto-approve / single manager / multi-level
- Delegation: manager assigns deputy approver when themselves on vacation
- SLA: escalation if request not acted on within N days

### Notifications
- Email (SMTP)
- Slack / Microsoft Teams webhooks
- In-app notification centre

### Staffing rules
- Minimum coverage: "Team X needs at least 2 people present Mon–Fri"
- Conflict detection: block or warn when booking would breach coverage rule
- Blackout periods: company-wide (e.g. year-end close) or per-team

### Admin & HR tools
- Company-wide calendar view with absence heatmap
- Year-end summary export (PDF / CSV) per employee and per department
- Compliance reports: flag employees who have not taken statutory minimum vacation
- Import employee list from HR system (CSV, or API integration with common HRIS)
- Bulk policy updates (change carry-over deadline for all employees at once)

---

## AI / MCP / CLI Extensions

**Trigger:** power users want to script, automate, or voice-control their vacation data, or want AI-assisted planning suggestions.

These extensions can be added independently of the v3/v4 roadmap.

### MCP Server
Expose My Holiday as a **Model Context Protocol server** so Claude (or any MCP-compatible AI client) can:
- Query remaining vacation days, upcoming vacations, carry-over status
- Suggest optimal vacation windows given remaining days, public holidays, and team coverage
- Book or cancel vacation via natural language ("Book me a week off in August avoiding school holidays")
- Answer questions about German vacation law (entitlement, carry-over, leave reductions)

### CLI
A `my-holiday` command-line interface for scripting and power users:

```bash
my-holiday list [--year 2026]
my-holiday add --start 2026-07-01 --end 2026-07-15 --type urlaub --note "Sommerurlaub"
my-holiday remaining [--year 2026]
my-holiday export --format ics --year 2026
my-holiday migrate ./urlaub-2026.csv
```

### Chat / Voice interface
- In-app natural language chat panel powered by Claude API
- Browser speech API for voice input ("How many days do I have left?")
- AI-generated suggestions surfaced proactively ("You have 12 days left and only 8 bookable weeks — here are 3 efficient options")

### Bridge day optimizer
- Dedicated AI-assisted view: given remaining days, find the highest-value vacation windows
- Ranked by days-off-per-vacation-day-spent, accounting for state-specific holidays
- One-click to pre-fill the vacation modal from a suggestion

---

## Family & Household Planner

**Trigger:** a household or couple wants to coordinate vacation and childcare without setting up a full multi-user authentication system.

### Household / partner mode

Multiple profiles on one instance, each with their own vacation budget, type configuration, and carry-over settings. A shared calendar overlay shows where periods overlap or conflict — useful for couples coordinating childcare cover or families planning around school holidays. Requires no full authentication system: profiles are switched via a simple dropdown, making it practical for a home server or NAS without setting up an IdP.

### Family organisation

- Parents, children, and other household members as named profiles
- Overview calendar consolidating all profiles in one view
- School holiday overlays per child (different states if needed)
- Conflict highlighting when two profiles have no overlap coverage during a school holiday period
