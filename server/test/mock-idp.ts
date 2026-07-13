import express from 'express';
import type { Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, generateKeyPair, exportJWK, type CryptoKey, type JWK } from 'jose';

/**
 * Minimal OIDC provider for integration tests (Phase 4, ADR-0007): serves
 * discovery + JWKS and implements the authorization code flow with PKCE
 * (S256), auto-approving the configured user. Enough for openid-client v6
 * with `allowInsecureRequests`; NOT a general-purpose IdP.
 */

export interface MockIdpUser {
  sub: string;
  email: string;
  name: string;
  /** email_verified claim in the id_token; defaults to true. */
  emailVerified?: boolean;
}

export interface MockIdp {
  /** Issuer URL, e.g. http://127.0.0.1:54321 */
  url: string;
  setUser(user: MockIdpUser): void;
  close(): Promise<void>;
}

interface PendingCode {
  codeChallenge: string | null;
  nonce: string | null;
  redirectUri: string;
  clientId: string;
  user: MockIdpUser;
}

function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function startMockIdp(): Promise<MockIdp> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), use: 'sig', alg: 'RS256', kid: 'mock-idp-key' };

  let user: MockIdpUser = { sub: 'idp|default', email: 'default@example.com', name: 'Default user' };
  const codes = new Map<string, PendingCode>();

  const app = express();
  app.use(express.urlencoded({ extended: false }));

  let issuer = ''; // known once the server is listening

  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  app.get('/jwks', (_req, res) => {
    res.json({ keys: [jwk] });
  });

  app.get('/authorize', (req, res) => {
    const { client_id, redirect_uri, state, code_challenge, nonce, response_type } = req.query as Record<
      string,
      string | undefined
    >;
    if (response_type !== 'code' || !client_id || !redirect_uri) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const code = randomBytes(16).toString('base64url');
    codes.set(code, {
      codeChallenge: code_challenge ?? null,
      nonce: nonce ?? null,
      redirectUri: redirect_uri,
      clientId: client_id,
      user,
    });

    const target = new URL(redirect_uri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    res.redirect(302, target.toString());
  });

  app.post('/token', async (req, res) => {
    const body = req.body as Record<string, string | undefined>;

    // client_secret_basic or client_secret_post — accept either.
    let clientId = body.client_id;
    const basic = /^Basic\s+(.+)$/i.exec(req.get('authorization') ?? '');
    if (basic) {
      clientId = decodeURIComponent(Buffer.from(basic[1], 'base64').toString('utf8').split(':')[0]);
    }

    const pending = body.code ? codes.get(body.code) : undefined;
    if (body.grant_type !== 'authorization_code' || !pending || pending.clientId !== clientId) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    codes.delete(body.code!); // single use
    if (pending.redirectUri !== body.redirect_uri) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
      return;
    }
    if (pending.codeChallenge !== null && (!body.code_verifier || s256(body.code_verifier) !== pending.codeChallenge)) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({
      email: pending.user.email,
      email_verified: pending.user.emailVerified ?? true,
      name: pending.user.name,
      ...(pending.nonce ? { nonce: pending.nonce } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'mock-idp-key' })
      .setIssuer(issuer)
      .setAudience(pending.clientId)
      .setSubject(pending.user.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey as CryptoKey);

    res.json({
      access_token: randomBytes(16).toString('base64url'),
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: idToken,
    });
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('mock IdP: unexpected server address');
  issuer = `http://127.0.0.1:${address.port}`;

  return {
    url: issuer,
    setUser(next: MockIdpUser) {
      user = next;
    },
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}
