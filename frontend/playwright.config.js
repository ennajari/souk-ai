// E2E against a running stack: backend on :8000 (fresh dev DB) + `npm run dev` on :5173.
// Uses the system Chrome (channel: 'chrome') — no browser download needed.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL || 'chrome',
    locale: 'fr-FR',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },
})
