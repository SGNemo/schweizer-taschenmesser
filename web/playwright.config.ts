import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// In sandboxes with a pre-installed Chromium (see CLAUDE.md) point Playwright at it.
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  // Multi-device tests need the real sync server: see playwright.sync.config.ts
  testIgnore: '**/sync/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Deterministic tests: no service worker caching between navigations.
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // e2e mode exposes the dev-only "Beispiel" module (see .env.e2e).
    command: 'npm run build:e2e && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
