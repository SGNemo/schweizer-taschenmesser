import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
// Temporary config for the identity v3 audit tour (seeded preview must run on :4174). Not committed.
const executablePath = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: ['p2-fix.spec.ts'],
  workers: 1,
  timeout: 0,
  reporter: 'list',
  use: {
    actionTimeout: 20_000,
    locale: 'de-DE',
    serviceWorkers: 'block',
    launchOptions: { executablePath },
    baseURL: process.env.P2_URL ?? 'http://localhost:4174',
  },
});
