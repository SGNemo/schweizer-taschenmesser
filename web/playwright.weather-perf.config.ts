// Manual tooling (not part of `npm run e2e` / CI): the weather scene's performance pass (elements, main thread during
// the motion and at rest, layout shift, hidden page), desktop and Pixel 7 with CPU 4× (set in the spec through CDP).
// Usage: `npm run measure:weather`; numbers: docs/perf/WEATHER-SCENES-2026-11.md.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/perf',
  testMatch: ['weather-scene.spec.ts'],
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: {
    locale: 'de-DE',
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    trace: 'off',
    actionTimeout: 30_000,
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // The stable e2e build (an empty app; every weather answer is mocked in the spec).
      command: 'npm run build:e2e && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
