// Manual tooling (not part of `npm run e2e` / CI): cold start on a throttled phone profile, see
// e2e/screenshots/coldstart.spec.ts and docs/perf/COLD-START-2026-10.md. Usage: `npm run measure:coldstart`.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/screenshots',
  testMatch: ['coldstart.spec.ts'],
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
  use: {
    locale: 'de-DE',
    baseURL: 'http://localhost:4175',
    // The second scenario measures the installed app: its service worker must be allowed.
    serviceWorkers: 'allow',
    launchOptions: { executablePath },
  },
  projects: [{ name: 'pixel-7', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      // The production build (same as users get), in its own folder so a running e2e preview stays untouched.
      command:
        'node scripts/check-bundle.mjs --build-only && vite preview --outDir dist-bundle --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
