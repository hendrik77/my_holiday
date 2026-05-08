import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      // Reset the test DB BEFORE spawning the server. (A globalSetup hook would
      // race against webServer startup and delete the just-created file.)
      command: 'rm -f data/my-holiday.test.db* && DB_PATH=data/my-holiday.test.db npm run server',
      port: 3001,
      timeout: 10_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      port: 5173,
      timeout: 10_000,
      reuseExistingServer: true,
    },
  ],
});
