import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createDb } from './db';
import { createRouter } from './routes';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || 'data/my-holiday.db';

const db = createDb(DB_PATH);
const app = express();

// Localhost-only tool by default. Override origins via CORS_ORIGIN; override
// bind interface via API_HOST (e.g. '0.0.0.0' for LAN access — only with auth).
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1', createRouter(db));

// Global error handler — catches thrown errors in route handlers.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV === 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.use((_req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, HOST, () => {
  console.log(`My Holiday API running on http://${HOST}:${PORT}`);
});

export { app };
