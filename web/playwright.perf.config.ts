// Manual tooling (not part of `npm run e2e` / CI): data-volume measurements on the Dev-Preview build with
// the `xl` test set, see e2e/perf/data.spec.ts and docs/perf/DATA-BASELINE-*.md. Usage: `npm run measure:data`.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/perf',
  testMatch: ['data.spec.ts'],
  workers: 1,
  timeout: 10_800_000,
  reporter: 'list',
  use: {
    locale: 'de-DE',
    baseURL: 'http://localhost:4174',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Phone: viewport and touch of a Pixel 7, CPU 4× slower (set in the spec through CDP).
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
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
