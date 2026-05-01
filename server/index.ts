import express from 'express';
import cors from 'cors';
import { createDb } from './db';
import { createRouter } from './routes';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const DB_PATH = process.env.DB_PATH || 'data/my-holiday.db';

const db = createDb(DB_PATH);
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/v1', createRouter(db));

app.listen(PORT, () => {
  console.log(`My Holiday API running on http://localhost:${PORT}`);
});

export { app };
