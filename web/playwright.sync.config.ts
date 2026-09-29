import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Multi-device sync tests against the real sync server (../server, in-memory SQLite).
 * They share one server, so they run serially (`workers: 1`).
 */
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export const SYNC_TOKEN = 'e2e-sync-token-0123456789';

export default defineConfig({
  testDir: './e2e/sync',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  projects: [{ name: 'sync', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run build:e2e && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm --prefix ../server run start:e2e',
      url: 'http://127.0.0.1:8787/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { SYNC_TOKEN, PORT: '8787', HOST: '127.0.0.1', DB_PATH: ':memory:', CORS_ORIGINS: '*' },
    },
  ],
});
