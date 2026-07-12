import { loadConfig, ConfigError } from './config';
import { createDb } from './db';
import { createApp } from './app';

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const db = await createDb(config);

// Localhost-only tool by default. Override origins via CORS_ORIGIN; override
// bind interface via API_HOST (e.g. '0.0.0.0' for LAN access — only with auth,
// e.g. API_TOKEN or an authenticating reverse proxy).
const app = createApp(db, {
  corsOrigin: config.CORS_ORIGIN,
  apiToken: config.API_TOKEN,
  serveStatic: process.env.NODE_ENV === 'production',
  authMode: config.AUTH_MODE,
});

app.listen(config.API_PORT, config.API_HOST, () => {
  console.log(`My Holiday API running on http://${config.API_HOST}:${config.API_PORT}`);
});

export { app };
