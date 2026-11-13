// Manual tooling (not part of `npm run e2e` / CI): click to content on the seeded Dev-Preview build, CPU slowed
// through CDP, see e2e/perf/click.spec.ts and docs/perf/CLICK-TO-CONTENT-2026-11.md. Usage: `npm run measure:click`.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/perf',
  testMatch: ['click.spec.ts'],
  // One page at a time: two throttled pages side by side would measure each other.
  workers: 1,
  timeout: 21_600_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'de-DE',
    baseURL: 'http://localhost:4174',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  webServer: [
    {
      // The Dev-Preview flavour (test-data tooling) built like `seed-dev` in playwright.config.ts.
      command: 'npm run build:e2e-seed && npm run preview:e2e-seed',
      url: 'http://localhost:4174',
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
