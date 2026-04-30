# My Holiday — Long-term Vision

> This document describes future direction beyond the current release.
> For the active development plan see [PLAN.md](./PLAN.md).
> For current features see [README.md](./README.md).

---

## Overview

My Holiday starts as a personal vacation planner for German employees. The long-term goal is to evolve it into a full **company holiday planner** — handling multi-user teams, approval workflows, and organisational calendars — while preserving the simplicity that makes the personal version useful.

---

## v3 — Multi-user + Authentication

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

## v4 — Company Holiday Planner

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
