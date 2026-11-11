import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// In sandboxes with a pre-installed Chromium (see CLAUDE.md) point Playwright at it.
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// CI profiles (docs/HOW-TO.md -> "Which checks run when"):
//   E2E_PROFILE=smoke  plain pull request: desktop-chrome only, the critical-path files below
//   E2E_PROFILE=rest   everything the smoke list does not cover (desktop-chrome without the smoke files, all of
//                      pixel-7): smoke + rest = the full suite, run next to the smoke list on full runs
//   E2E_SEED=0         leave out the seed project and its second web server (CI shards; the seed project
//                      runs in its own job `e2e-seed` on full runs)
// Nothing set (local, `npm run e2e:app`): everything, as before.
const smoke = process.env.E2E_PROFILE === 'smoke';
const rest = process.env.E2E_PROFILE === 'rest';
const withSeed = !smoke && !rest && process.env.E2E_SEED !== '0';
// Add a spec here when it guards start-up, data safety, navigation or a module's create/edit path; everything
// else runs on develop, nightly and with the label `full-ci`. The second block holds the standing promises of
// the UI rebuild (UI audit 2026-11, package 0a-1a): they run on every pull request, on desktop-chrome; the
// phone ones set their own viewport with `test.use`. This file is ratchet-protected (docs/howto/ci.md).
const SMOKE_FILES = [
  'core',
  'shell',
  'home',
  'modules',
  'setup',
  'onboarding',
  'settings',
  'backup',
  'offline',
  'accounts',
  'money',
  'subscriptions-plus',
  'todos-views',
  'calendar-views',
  'notes',
  'lists',
  'reminders',
  'assistant',
  'i18n',
  'update-path',
  'safe-mode',
  'create',
  'delete-undo',
  'today',
  'cockpit',
  'a11y',
  'calm',
  'hide-values',
  'mobile-layout',
  'touch-hit-phone',
  'layout',
  'readability',
  'identity',
  'hue-consistency',
  'library-identity',
  'overview-head',
].map((name) => new RegExp(`/${name}\\.spec\\.ts$`));

// Multi-device tests need the real sync server: see playwright.sync.config.ts
// `screenshots/` is manual tooling (playwright.screens.config.ts), not part of the suite.
const NOT_IN_APP_SUITE = ['**/sync/**', '**/screenshots/**', '**/seed/**', '**/perf/**'];

export default defineConfig({
  testDir: './e2e',
  testIgnore: NOT_IN_APP_SUITE,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI: annotations plus the retried (flaky) tests in the job summary (e2e/reporters/flaky-summary.ts).
  reporter: process.env.CI ? [['github'], ['./e2e/reporters/flaky-summary.ts']] : 'list',
  use: {
    // The app follows the device language; the specs assert German texts.
    locale: 'de-DE',
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Deterministic tests: no service worker caching between navigations.
    serviceWorkers: 'block',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
      ...(smoke ? { testMatch: SMOKE_FILES } : {}),
      ...(rest ? { testIgnore: [...NOT_IN_APP_SUITE, ...SMOKE_FILES] } : {}),
    },
    ...(smoke ? [] : [{ name: 'pixel-7', use: { ...devices['Pixel 7'] } }]),
    ...(withSeed
      ? [
          {
            // Dev-Preview flavour (VITE_RELEASE_CHANNEL=dev): test-data tooling, see e2e/seed/.
            name: 'seed-dev',
            testIgnore: ['**/sync/**', '**/screenshots/**'],
            testMatch: '**/seed/**/*.spec.ts',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4174' },
          },
        ]
      : []),
  ],
  webServer: [
    {
      // e2e mode exposes the dev-only "Beispiel" module (see .env.e2e).
      command: 'npm run build:e2e && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(withSeed
      ? [
          {
            // Same app built as a Dev-Preview (.env.e2e-seed), served from its own folder and port.
            command: 'npm run build:e2e-seed && npm run preview:e2e-seed',
            url: 'http://localhost:4174',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
  ],
});
