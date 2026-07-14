import { defineConfig } from '@playwright/test';

/**
 * Browser E2E for multi-user (OIDC) mode. Unlike the default single-user
 * smoke suite, this boots the app the way it actually runs in production:
 * one origin (the API serves the built SPA on :3001), AUTH_MODE=oidc against
 * PostgreSQL and a standalone mock IdP — so real session cookies round-trip
 * through the browser.
 *
 * Prerequisites (the runner supplies them; see `npm run test:e2e:oidc`):
 *   - a built SPA in dist/ (the API serves it)
 *   - PostgreSQL reachable at E2E_DATABASE_URL
 * Locally: start Postgres, create the DB, then `npm run test:e2e:oidc`.
 * In CI: a postgres service container provides E2E_DATABASE_URL.
 */
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://holiday:holiday@localhost:5432/holiday_e2e';
const MOCK_IDP_PORT = '9099';
const BASE_URL = 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e-oidc',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: `MOCK_IDP_PORT=${MOCK_IDP_PORT} MOCK_IDP_EMAIL=e2e@example.com npx tsx server/test/mock-idp-server.ts`,
      port: Number(MOCK_IDP_PORT),
      timeout: 15_000,
      reuseExistingServer: false,
    },
    {
      // Production single-origin server: NODE_ENV=production makes it serve
      // the built SPA, so cookies are same-origin. The API runs migrations
      // on the (empty) Postgres at startup.
      command: [
        'NODE_ENV=production',
        'DB_DRIVER=postgres',
        `DATABASE_URL=${DATABASE_URL}`,
        'AUTH_MODE=oidc',
        `OIDC_ISSUER_URL=http://127.0.0.1:${MOCK_IDP_PORT}`,
        'OIDC_CLIENT_ID=e2e-client',
        'OIDC_CLIENT_SECRET=e2e-secret',
        `PUBLIC_BASE_URL=${BASE_URL}`,
        'SESSION_SECRET=e2e-session-secret-at-least-32-bytes!!',
        'ADMIN_EMAILS=e2e@example.com',
        'npm run server',
      ].join(' '),
      port: 3001,
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
});
