import express from 'express';
import cors from 'cors';
import { createDb } from './db';
import { createRouter } from './routes';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const DB_PATH = process.env.DB_PATH || 'data/my-holiday.db';

const db = createDb(DB_PATH);
const app = express();

// Localhost-only tool; restrict origins in production via CORS_ORIGIN env var if needed.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json());
app.use('/api/v1', createRouter(db));

// Global error handler — catches thrown errors in route handlers.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`My Holiday API running on http://localhost:${PORT}`);
});

export { app };
