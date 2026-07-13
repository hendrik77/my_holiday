// @vitest-environment node
// openid-client/jose need the node environment (cross-realm Uint8Array
// breaks their browser builds under jsdom).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as oidc from 'openid-client';
import { startMockIdp, type MockIdp } from '../test/mock-idp';

/**
 * The mock IdP must speak enough OIDC for openid-client v6 discovery and the
 * authorization code + PKCE flow — it is the test double for Phase 4's auth
 * routes, so it gets its own contract test against the real client library.
 */
describe('mock IdP', () => {
  let idp: MockIdp;

  beforeAll(async () => {
    idp = await startMockIdp();
    idp.setUser({ sub: 'idp|carol', email: 'carol@example.com', name: 'Carol' });
  });

  afterAll(async () => {
    await idp.close();
  });

  async function discover() {
    return oidc.discovery(new URL(idp.url), 'test-client', 'test-secret', undefined, {
      execute: [oidc.allowInsecureRequests],
    });
  }

  it('serves a discovery document with the endpoints openid-client needs', async () => {
    const config = await discover();
    const meta = config.serverMetadata();
    expect(meta.issuer).toBe(idp.url);
    expect(meta.authorization_endpoint).toBeDefined();
    expect(meta.token_endpoint).toBeDefined();
    expect(meta.jwks_uri).toBeDefined();
    expect(meta.code_challenge_methods_supported).toContain('S256');
  });

  it('completes an authorization code + PKCE flow and returns verifiable claims', async () => {
    const config = await discover();
    const redirectUri = 'http://127.0.0.1:9/callback'; // never actually fetched

    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();

    const authUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    const res = await fetch(authUrl, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const callback = new URL(res.headers.get('location')!);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get('state')).toBe(state);

    const tokens = await oidc.authorizationCodeGrant(config, callback, {
      pkceCodeVerifier: verifier,
      expectedState: state,
      expectedNonce: nonce,
    });
    const claims = tokens.claims()!;
    expect(claims.sub).toBe('idp|carol');
    expect(claims.email).toBe('carol@example.com');
    expect(claims.name).toBe('Carol');
  });

  it('rejects a token exchange with the wrong PKCE verifier', async () => {
    const config = await discover();
    const redirectUri = 'http://127.0.0.1:9/callback';

    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const state = oidc.randomState();

    const authUrl = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    const res = await fetch(authUrl, { redirect: 'manual' });
    const callback = new URL(res.headers.get('location')!);

    await expect(
      oidc.authorizationCodeGrant(config, callback, {
        pkceCodeVerifier: oidc.randomPKCECodeVerifier(), // wrong verifier
        expectedState: state,
      }),
    ).rejects.toThrow();
  });
});
