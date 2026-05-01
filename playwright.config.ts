import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run server',
      port: 3001,
      timeout: 10_000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      port: 5173,
      timeout: 10_000,
      reuseExistingServer: true,
    },
  ],
});
