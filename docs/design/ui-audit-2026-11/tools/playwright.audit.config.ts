import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
// UI audit 2026-11 (docs/design/ui-audit-2026-11): seeded Dev-Preview on :4174 (`npm run build:e2e-seed && npm run preview:e2e-seed`).
// Copy this file and the two specs into `web/` / `web/e2e/screenshots/` like the round-6 tools; not part of CI.
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: ['audit-tour.spec.ts', 'click-paths.spec.ts'],
  workers: Number(process.env.UA_WORKERS ?? 3),
  fullyParallel: true,
  timeout: 0,
  reporter: 'list',
  use: {
    actionTimeout: 15_000,
    locale: 'de-DE',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
    baseURL: process.env.UA_URL ?? 'http://localhost:4174',
  },
});
