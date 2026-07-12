import express from 'express';
import cors from 'cors';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { Db } from './db/types';
import { createRouter } from './routes';

export interface CreateAppOptions {
  /** CORS origin override; by default only local origins (localhost, 127.0.0.1, [::1]) are allowed. */
  corsOrigin?: string;
  /** When set, every /api/v1 request must carry `Authorization: Bearer <token>`. */
  apiToken?: string;
  /** Serve the built SPA from dist/ (production single-port mode). */
  serveStatic?: boolean;
  /** AUTH_MODE from config. 'oidc' is rejected until the auth layer (Phase 4) exists. */
  authMode?: 'none' | 'oidc';
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
export function createApp(db: Db, options: CreateAppOptions = {}): express.Express {
  // Fail closed: config already validates AUTH_MODE=oidc, but no middleware
  // sets req.user yet — booting would serve an unauthenticated API where
  // every caller acts as the shared default admin user. Removed in Phase 4.
  if (options.authMode === 'oidc') {
    throw new Error('AUTH_MODE=oidc is not supported by this build yet — the OIDC auth layer lands in a later release');
  }

  const app = express();

  app.use(
    cors({
      origin:
        options.corsOrigin ??
        ((origin, callback) => callback(null, origin === undefined || LOCAL_ORIGIN_RE.test(origin))),
    }),
  );
  app.use(express.json({ limit: '32kb' }));

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
