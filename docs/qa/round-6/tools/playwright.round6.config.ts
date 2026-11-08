import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
// UI round 6 tour (docs/qa/round-6): seeded Dev-Preview must run on :4174 (`npm run preview:e2e-seed`). Not committed to CI.
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: ['round6.spec.ts'],
  workers: Number(process.env.R6_WORKERS ?? 3),
  fullyParallel: true,
  timeout: 0,
  reporter: 'list',
  use: {
    actionTimeout: 15_000,
    locale: 'de-DE',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
    baseURL: process.env.R6_URL ?? 'http://localhost:4174',
  },
});
