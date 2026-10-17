// Manual tooling (not part of CI): stimulus inventory of the seeded Dev-Preview build, see e2e/screenshots/stimulus.spec.ts.
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const executablePath = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: ['stimulus.spec.ts'],
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
  use: {
    locale: 'de-DE',
    serviceWorkers: 'block',
    baseURL: 'http://localhost:4174',
    launchOptions: { executablePath },
  },
  projects: [{ name: 'audit' }],
  webServer: [
    {
      command: 'npm run build:e2e-seed && npm run preview:e2e-seed',
      url: 'http://localhost:4174',
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
