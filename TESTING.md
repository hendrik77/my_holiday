# Testing & manual verification

How to run the automated suites and manually exercise both run modes.
Single-user mode is the default; multi-user (OIDC) mode is opt-in and needs
PostgreSQL + an identity provider.

## Prerequisites

- Node 20+ and `npm ci`.
- Multi-user mode only: PostgreSQL, and either Docker (for the bundled
  Keycloak stack) or your own OIDC provider.

## Automated tests

```bash
npm test              # unit + integration (vitest)
npm run test:e2e      # single-user browser smoke (Playwright, SQLite)
npm run lint
npm run typecheck
```

The PostgreSQL leg of the repository contract suite and the OIDC browser E2E
need a database:

```bash
# repo contract suite against PostgreSQL
TEST_DATABASE_URL=postgres://holiday:holiday@localhost:5432/holiday_test npm test

# multi-user OIDC browser journey (login → book → logout), production single-origin
E2E_DATABASE_URL=postgres://holiday:holiday@localhost:5432/holiday_e2e npm run test:e2e:oidc
```

Both databases must exist and be empty; the app runs its migrations on
startup. In CI a `postgres:17-alpine` service container provides them.

## Manual — single-user mode (default)

No database or login setup; behaves exactly like a pre-v3 install.

```bash
npm run server   # API on :3001, SQLite at data/my-holiday.db
npm run dev      # SPA on :5173 (separate terminal)
# open http://localhost:5173
```

Exercise: the first-run wizard, booking/editing vacations, the four views,
settings, CSV import/export, and the CLI (`MY_HOLIDAY_API_TOKEN` only matters
if you set `API_TOKEN`).

## Manual — multi-user (OIDC) mode

Multi-user mode must run **production single-origin** — the API serves the
built SPA on one port — so `SameSite=Lax` session cookies round-trip through
the browser. Running the Vite dev server (5173) against the API (3001) will
not work for the login flow because the cookie origin differs.

### Option A — bundled Keycloak (recommended; self-contained via Docker)

The compose stack brings up PostgreSQL **and** a Keycloak with a ready realm
(user `alice` / `alice`):

```bash
docker compose -f docker-compose.dev-keycloak.yml up -d

NODE_ENV=production DB_DRIVER=postgres \
  DATABASE_URL=postgres://holiday:holiday@localhost:5432/holiday \
  AUTH_MODE=oidc \
  OIDC_ISSUER_URL=http://localhost:8080/realms/my-holiday \
  OIDC_CLIENT_ID=my-holiday OIDC_CLIENT_SECRET=dev-secret \
  PUBLIC_BASE_URL=http://localhost:3001 \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  ADMIN_EMAILS=alice@example.com \
  npm run build && npm run server
# open http://localhost:3001 → "Anmelden" → sign in as alice / alice
```

To test the **manager overlay**, add a second user in the Keycloak admin
console (http://localhost:8080, admin/admin), sign in once as them to create
the account, then as `alice` (admin) go to **Settings → Organisation** and
set that user's manager to alice / alice's role to manager.

### Option B — mock IdP (no Docker; needs your own PostgreSQL)

Auto-approves one preset user — the quickest smoke, and the exact setup the
E2E suite uses:

```bash
# 1. a running PostgreSQL with an empty database, e.g. reachable at
#    postgres://holiday@localhost:5432/holiday
# 2. start the mock IdP
MOCK_IDP_PORT=9099 MOCK_IDP_EMAIL=you@example.com npx tsx server/test/mock-idp-server.ts &
# 3. start the app
NODE_ENV=production DB_DRIVER=postgres \
  DATABASE_URL=postgres://holiday@localhost:5432/holiday \
  AUTH_MODE=oidc OIDC_ISSUER_URL=http://127.0.0.1:9099 \
  OIDC_CLIENT_ID=c OIDC_CLIENT_SECRET=s \
  PUBLIC_BASE_URL=http://localhost:3001 \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  ADMIN_EMAILS=you@example.com \
  npm run build && npm run server
# open http://localhost:3001 → "Anmelden" (no credential prompt)
```

### What to verify

- [ ] **Login** redirects to the IdP and returns you authenticated; the
      first-run wizard appears for a new user.
- [ ] **Booking a vacation** succeeds (proves the session cookie authenticates
      `POST /api/v1/periods`).
- [ ] **Settings → API tokens**: create a personal access token (shown once),
      then use it from the CLI — `MY_HOLIDAY_API_TOKEN=mh_pat_… holiday list`.
      A `read` token rejects writes; revoking it revokes CLI access immediately.
- [ ] **Settings → Organisation** (admin only): change the privacy level and
      assign roles/managers.
- [ ] **Team** tab (managers/admins): shows direct reports' booked dates;
      notes appear only when the privacy level is "dates and notes".
- [ ] **Logout** returns to the login page. Set `ACCESS_TOKEN_TTL_S=30` to
      watch the silent refresh renew the session mid-use.

## SQLite → PostgreSQL migration

Copy a single-user SQLite database into an empty PostgreSQL one (ids and
timestamps preserved; refuses a non-empty target):

```bash
npm run migrate:postgres -- \
  --sqlite data/my-holiday.db \
  --database-url postgres://holiday:holiday@localhost:5432/holiday
```
