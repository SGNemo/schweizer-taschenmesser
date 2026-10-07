import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  workers: 1, // one browser with the extension and one app page at a time
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  // The real app (e2e build) serves as "the desktop app": the extension's native host relays into it.
  webServer: {
    command: 'cd ../web && npm run build:e2e && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
