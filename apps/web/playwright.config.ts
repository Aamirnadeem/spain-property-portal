import { defineConfig, devices } from '@playwright/test';

// A dedicated port and database keep e2e runs isolated from a developer's own `pnpm dev`
// session (which points at spain_properties and must never be reset by the suite).
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/spain_properties_e2e';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    // /api/health does not touch Postgres, so the server can become ready before
    // globalSetup recreates the e2e database.
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabaseUrl,
      OTP_PROVIDER: process.env.OTP_PROVIDER ?? 'fake',
      FAKE_SESSION_SECRET: process.env.FAKE_SESSION_SECRET ?? 'dev-only-fake-session-secret',
      NODE_ENV: 'development',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
