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
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  projects: [
    {
      // The layout tour runs on the Dev-Preview flavour with the shared, seeded test data.
      name: 'seeded',
      testMatch: 'capture.spec.ts',
      use: { baseURL: 'http://localhost:4174' },
    },
    {
      // Specs that start from an empty app (setup assistant, disk) need the stable e2e build.
      name: 'plain',
      testIgnore: 'capture.spec.ts',
      use: { baseURL: 'http://localhost:4173' },
    },
  ],
  webServer: [
    {
      command: 'npm run build:e2e && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run build:e2e-seed && npm run preview:e2e-seed',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
