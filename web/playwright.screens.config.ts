import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Manual tooling (not part of `npm run e2e` / CI): renders every module in a set of viewports
// with invented demo data. Usage: SCREENS_DIR=test-results/screens/before npm run screenshots
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/screenshots',
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'npm run build:e2e && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
