import { createDb } from './db';
import { createApp } from './app';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || 'data/my-holiday.db';

const db = createDb(DB_PATH);

// Localhost-only tool by default. Override origins via CORS_ORIGIN; override
// bind interface via API_HOST (e.g. '0.0.0.0' for LAN access — only with auth).
const app = createApp(db, {
  corsOrigin: process.env.CORS_ORIGIN,
  serveStatic: process.env.NODE_ENV === 'production',
});

app.listen(PORT, HOST, () => {
  console.log(`My Holiday API running on http://${HOST}:${PORT}`);
});

export { app };
