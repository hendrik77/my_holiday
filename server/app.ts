import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type Database from 'better-sqlite3';
import { createRouter } from './routes';

export interface CreateAppOptions {
  /** CORS origin passed through to the cors middleware; defaults to reflecting any origin. */
  corsOrigin?: string;
  /** Serve the built SPA from dist/ (production single-port mode). */
  serveStatic?: boolean;
}

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

/** Build the Express app: CORS, JSON body parsing, API routes, optional SPA serving. */
export function createApp(db: Database.Database, options: CreateAppOptions = {}): express.Express {
  const app = express();

  app.use(cors({ origin: options.corsOrigin ?? true }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', createRouter(db));

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
