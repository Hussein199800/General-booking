import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the real stack: a throw-away PostgreSQL database, the
 * built API (as the least-privilege sba_app role) and the built web app
 * (`next start`, not the static preview). See setup/global-setup.ts.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './setup/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3100',
    locale: 'ar-SY',
    timezoneId: 'Asia/Damascus',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
});
