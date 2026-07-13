import { Router, type Response } from 'express';
import * as oidc from 'openid-client';
import { SignJWT, jwtVerify } from 'jose';
import type { Db } from '../db/types';
import type { Config } from '../config';
import type { UserRow } from '../types';
import { createSessionToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from './session';
import { requireUser } from './middleware';

/**
 * Auth endpoints (ADR-0007), mounted at /api/v1/auth. login/callback/
 * refresh/logout exist only in oidc mode and are reachable without a
 * session; /me exists in both modes and identifies the acting user.
 *
 * Cookies: mh_session (app JWT, path /), mh_refresh (opaque, scoped to this
 * router's path so it never rides on data requests), mh_oidc (short-lived
 * signed login state: state/nonce/PKCE verifier).
 */

const SESSION_COOKIE = 'mh_session';
const REFRESH_COOKIE = 'mh_refresh';
const LOGIN_COOKIE = 'mh_oidc';
const AUTH_PATH = '/api/v1/auth';
const LOGIN_STATE_TTL_S = 600;

const encoder = new TextEncoder();

interface LoginState {
  state: string;
  nonce: string;
  verifier: string;
}

function cookieOptions(config: Config, path: string, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: (config.PUBLIC_BASE_URL ?? '').startsWith('https'),
    path,
    maxAge: maxAgeSeconds * 1000,
  };
}

async function setSessionCookie(res: Response, config: Config, user: UserRow): Promise<void> {
  const session = await createSessionToken(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.SESSION_SECRET!,
    config.ACCESS_TOKEN_TTL_S,
  );
  res.cookie(SESSION_COOKIE, session, cookieOptions(config, '/', config.ACCESS_TOKEN_TTL_S));
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: AUTH_PATH });
}

export async function createAuthRouter(db: Db, config: Config): Promise<Router> {
  const router = Router();

  router.get('/me', requireUser(db, config), (req, res) => {
    const { id, name, email, team, role } = req.user!;
    res.json({ id, name, email, team, role, authMode: config.AUTH_MODE });
  });

  if (config.AUTH_MODE !== 'oidc') return router;

  const secretKey = encoder.encode(config.SESSION_SECRET!);
  const issuerUrl = new URL(config.OIDC_ISSUER_URL!);
  // http issuers exist only in tests/dev (mock IdP); real IdPs are https.
  const clientConfig = await oidc.discovery(
    issuerUrl,
    config.OIDC_CLIENT_ID!,
    config.OIDC_CLIENT_SECRET!,
    undefined,
    issuerUrl.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
  );
  const redirectUri = `${config.PUBLIC_BASE_URL}${AUTH_PATH}/callback`;

  router.get('/login', async (_req, res, next) => {
    try {
      const verifier = oidc.randomPKCECodeVerifier();
      const loginState: LoginState = {
        state: oidc.randomState(),
        nonce: oidc.randomNonce(),
        verifier,
      };
      const stateJwt = await new SignJWT({ ...loginState })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + LOGIN_STATE_TTL_S)
        .sign(secretKey);
      res.cookie(LOGIN_COOKIE, stateJwt, cookieOptions(config, AUTH_PATH, LOGIN_STATE_TTL_S));

      const authUrl = oidc.buildAuthorizationUrl(clientConfig, {
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        state: loginState.state,
        nonce: loginState.nonce,
      });
      res.redirect(302, authUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  router.get('/callback', async (req, res) => {
    try {
      const stateJwt = (req.cookies as Record<string, string> | undefined)?.[LOGIN_COOKIE];
      if (!stateJwt) {
        res.status(400).json({ error: 'Missing login state — start again at /api/v1/auth/login' });
        return;
      }
      const { payload } = await jwtVerify(stateJwt, secretKey, { algorithms: ['HS256'] });
      const loginState = payload as unknown as LoginState;

      const tokens = await oidc.authorizationCodeGrant(
        clientConfig,
        new URL(req.originalUrl, config.PUBLIC_BASE_URL),
        {
          pkceCodeVerifier: loginState.verifier,
          expectedState: loginState.state,
          expectedNonce: loginState.nonce,
        },
      );
      const claims = tokens.claims()!;

      let user = await db.users.upsertFromIdP({
        oidcSub: claims.sub,
        email: String(claims.email ?? ''),
        name: String(claims.name ?? ''),
      });
      if (config.ADMIN_EMAILS.includes(user.email.toLowerCase()) && user.role !== 'admin') {
        user = (await db.users.updateProfile(user.id, { role: 'admin' }))!;
      }

      res.clearCookie(LOGIN_COOKIE, { path: AUTH_PATH });
      await setSessionCookie(res, config, user);
      const refresh = await issueRefreshToken(db, user.id, config.REFRESH_TOKEN_TTL_S);
      res.cookie(REFRESH_COOKIE, refresh.token, cookieOptions(config, AUTH_PATH, config.REFRESH_TOKEN_TTL_S));
      res.redirect(302, '/');
    } catch (error) {
      // Never leak IdP/exchange details to the browser; log server-side.
      console.error('OIDC callback failed:', error);
      res.status(401).json({ error: 'Login failed' });
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
      const rotated = raw ? await rotateRefreshToken(db, raw, config.REFRESH_TOKEN_TTL_S) : null;
      const user = rotated ? await db.users.findById(rotated.userId) : null;
      if (!rotated || !user) {
        clearAuthCookies(res);
        res.status(401).json({ error: 'Session expired' });
        return;
      }
      await setSessionCookie(res, config, user);
      res.cookie(REFRESH_COOKIE, rotated.token, cookieOptions(config, AUTH_PATH, config.REFRESH_TOKEN_TTL_S));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
      if (raw) await revokeRefreshToken(db, raw);
      clearAuthCookies(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
