/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pin a fixed, non-UTC timezone for the test run so date-handling code (e.g.
// the CLI's local "today") is exercised and asserted deterministically,
// independent of the machine/CI timezone. Set before workers spawn.
process.env.TZ = 'Europe/Berlin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'scripts/**/*.test.ts', 'cli/**/*.test.ts'],
  },
})
