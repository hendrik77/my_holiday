import { startMockIdp } from './mock-idp';

/**
 * Standalone mock OIDC provider for the browser E2E suite. Runs on a fixed
 * port (MOCK_IDP_PORT, default 9999) and auto-approves one preset user, so
 * the Playwright oidc project can point the API's OIDC_ISSUER_URL at it. Not
 * for production — see server/test/mock-idp.ts.
 */
const port = Number(process.env.MOCK_IDP_PORT ?? 9999);

const idp = await startMockIdp(port);
idp.setUser({
  sub: 'idp|e2e',
  email: process.env.MOCK_IDP_EMAIL ?? 'e2e@example.com',
  name: 'E2E User',
});
console.log(`mock IdP listening on ${idp.url}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void idp.close().then(() => process.exit(0));
  });
}
