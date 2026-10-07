import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// In sandboxes with a pre-installed Chromium (see CLAUDE.md) point Playwright at it.
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  // Multi-device tests need the real sync server: see playwright.sync.config.ts
  // `screenshots/` is manual tooling (playwright.screens.config.ts), not part of the suite.
  testIgnore: ['**/sync/**', '**/screenshots/**', '**/seed/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // The app follows the device language; the specs assert German texts.
    locale: 'de-DE',
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Deterministic tests: no service worker caching between navigations.
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    {
      // Dev-Preview flavour (VITE_RELEASE_CHANNEL=dev): test-data tooling, see e2e/seed/.
      name: 'seed-dev',
      testIgnore: ['**/sync/**', '**/screenshots/**'],
      testMatch: '**/seed/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4174' },
    },
  ],
  webServer: [
    {
      // e2e mode exposes the dev-only "Beispiel" module (see .env.e2e).
      command: 'npm run build:e2e && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Same app built as a Dev-Preview (.env.e2e-seed), served from its own folder and port.
      command: 'npm run build:e2e-seed && npm run preview:e2e-seed',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
