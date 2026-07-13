import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { Db } from './db/types';
import type { Config } from './config';
import { createRouter } from './routes';
import { createOrgRouter } from './org-routes';
import { createAuthRouter } from './auth/routes';
import { createTokensRouter } from './auth/tokens';
import { requireUser } from './auth/middleware';

export interface CreateAppOptions {
  /** CORS origin override; by default only local origins (localhost, 127.0.0.1, [::1]) are allowed. */
  corsOrigin?: string;
  /** When set, every /api/v1 request must carry `Authorization: Bearer <token>`. */
  apiToken?: string;
  /** Serve the built SPA from dist/ (production single-port mode). */
  serveStatic?: boolean;
  /** AUTH_MODE from config; 'oidc' additionally requires `config`. */
  authMode?: 'none' | 'oidc';
  /** Full runtime config — enables the auth endpoints (/api/v1/auth). */
  config?: Config;
}

// Same-machine origins (any port). Cross-origin reads from arbitrary websites
// are not allowed by default — set CORS_ORIGIN to open up a specific origin.
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

/** Build the Express app: CORS, JSON body parsing, API routes, optional SPA serving. */
export async function createApp(db: Db, options: CreateAppOptions = {}): Promise<express.Express> {
  const authMode = options.authMode ?? 'none';
  // Fail closed: oidc mode without the config wiring would serve an
  // unauthenticated API where every caller acts as the default admin user.
  if (authMode === 'oidc' && !options.config) {
    throw new Error('AUTH_MODE=oidc requires createApp to receive the runtime config');
  }

  const app = express();
  // Exactly one reverse-proxy hop (the deployment model behind
  // PUBLIC_BASE_URL). Never `true`: that trusts the whole client-supplied
  // X-Forwarded-For chain and makes req.ip spoofable (security review M1).
  if (authMode === 'oidc') app.set('trust proxy', 1);

  app.use(
    cors({
      origin:
        options.corsOrigin ??
        ((origin, callback) => callback(null, origin === undefined || LOCAL_ORIGIN_RE.test(origin))),
      // The SPA sends cookies (credentials: 'include'); without this the
      // browser discards cross-origin responses in dev (5173 → 3001).
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  // Liveness probe — intentionally outside the bearer-token guard so Docker
  // healthchecks and monitoring work without credentials.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (options.apiToken) {
    // Hashing both sides gives timingSafeEqual equal-length buffers.
    const expected = sha256(options.apiToken);
    app.use('/api/v1', (req, res, next) => {
      const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
      if (match && timingSafeEqual(expected, sha256(match[1]))) {
        next();
        return;
      }
      res.status(401).json({ error: 'Missing or invalid bearer token' });
    });
  }

  if (options.config) {
    if (options.config.AUTH_MODE === 'oidc') {
      // Every /api/v1 request may carry an unauthenticated PAT that costs a
      // DB lookup before rejection — bound the flood per IP (security
      // review H1). Generous enough for normal SPA bursts.
      app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
    }
    // login/callback/refresh/logout must stay reachable without a session;
    // /me carries its own requireUser. In oidc mode everything below this
    // mount requires a valid session cookie.
    app.use('/api/v1/auth', await createAuthRouter(db, options.config));
    if (options.config.AUTH_MODE === 'oidc') {
      // Session-cookie-only self-service (a PAT cannot manage PATs);
      // carries its own auth, so it mounts before the general guard.
      app.use('/api/v1/tokens', createTokensRouter(db, options.config));
    }
    app.use('/api/v1', requireUser(db, options.config));
    // Team overlay + org administration — behind the guard so requireRole
    // can read req.user; distinct paths from the per-user router below.
    app.use('/api/v1', createOrgRouter(db));
  }
  app.use('/api/v1', createRouter(db));

  // Unknown API paths get a JSON 404 — never the SPA fallback HTML.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (options.serveStatic) {
    const distPath = join(dirname(fileURLToPath(import.meta.url)), '../dist');
    app.use(express.static(distPath));
    app.use((_req, res) => res.sendFile(join(distPath, 'index.html')));
  }

  // Global error handler. Errors thrown by middleware carry a status —
  // e.g. the JSON body parser: malformed body → 400, over the 32kb limit
  // → 413. Those keep their status; everything else is a logged 500.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: HttpError, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.status(status).json({ error: err.expose === false ? 'Request error' : err.message });
  });

  return app;
}
