import { test as base, expect, type BrowserContextOptions, type Page } from '@playwright/test';

/** Reference date of all seeded E2E data (`page.clock.setFixedTime`). Seed version in the status. */
export const SEED_TODAY = '2026-09-29';

/**
 * Prepares a page of the dev-flavoured app (`playwright.config.ts` project `seed-dev`): fixed
 * clock, and the first-start auto-fill switched off unless a test is about it.
 */
export async function bootDev(page: Page, opts: { autofill?: boolean } = {}) {
  await page.clock.setFixedTime(new Date(`${SEED_TODAY}T10:00:00`));
  if (!opts.autofill)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tm-seed-autofilled', '1');
      } catch {
        // storage blocked – then auto-fill would not run either
      }
    });
}

/** Settings → Entwickler → "Testdaten laden" for `scale` and waits until the status shows it. */
export async function seedApp(page: Page, scale: 'small' | 'medium' | 'large' = 'small') {
  await page.goto('/settings/entwickler');
  await expect(page.locator('main h1')).toBeVisible();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption(scale);
  await section.getByTestId('seed-load').click();
  await expect(section.getByTestId('seed-status')).toContainText(SEED_TODAY, { timeout: 60_000 });
}

/** What a seeded snapshot holds: the seed scale and how the app was set up while seeding. */
export interface SeedSnapshot {
  scale: 'small' | 'medium' | 'large';
  /** Seed as the desktop app (`__tmPlatformKind`), so desktop-only modules get their data. */
  desktop?: boolean;
  /** Seed with "In Arbeit anzeigen" on (`tm-show-preview`). */
  preview?: boolean;
}

type State = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/**
 * `test` with a seeded start: `test.use({ seeded: { scale: 'medium' } })` gives every test a fresh context
 * whose IndexedDB and localStorage are a copy of an app that went through "Testdaten laden" once per worker
 * (`seedApp`, the real UI path; 10 to 13 s per call). Tests still write only to their own copy. Specs about
 * loading the seed itself (`seed.spec.ts`) keep calling `seedApp`. The snapshot is taken in a plain context
 * (no viewport or phone emulation; no seed code reads them) and built by the first test that needs it, which
 * gets two extra minutes on its timeout for that.
 */
export const test = base.extend<
  { seeded: SeedSnapshot | null },
  { seedSnapshot: { has: (o: SeedSnapshot) => boolean; get: (o: SeedSnapshot) => Promise<State> } }
>({
  seeded: [null, { option: true }],
  seedSnapshot: [
    async ({ browser }, provide, workerInfo) => {
      const cache = new Map<string, Promise<State>>();
      const { baseURL, locale, serviceWorkers } = workerInfo.project.use;
      const keyOf = (o: SeedSnapshot) => JSON.stringify([o.scale, !!o.desktop, !!o.preview]);
      await provide({
        has: (o) => cache.has(keyOf(o)),
        get: (o) => {
          let state = cache.get(keyOf(o));
          if (!state) {
            state = (async () => {
              const context = await browser.newContext({ baseURL, locale, serviceWorkers });
              try {
                const page = await context.newPage();
                await page.addInitScript(
                  ({ desktop, preview }) => {
                    if (desktop) localStorage.setItem('__tmPlatformKind', 'desktop');
                    if (preview) localStorage.setItem('tm-show-preview', '1');
                  },
                  { desktop: !!o.desktop, preview: !!o.preview },
                );
                await bootDev(page);
                await seedApp(page, o.scale);
                return await context.storageState({ indexedDB: true });
              } finally {
                await context.close();
              }
            })();
            cache.set(keyOf(o), state);
          }
          return state;
        },
      });
    },
    { scope: 'worker' },
  ],
  storageState: async ({ seeded, seedSnapshot, storageState }, provide, testInfo) => {
    if (!seeded) return provide(storageState);
    // Building the snapshot runs inside this test's time budget: give it the time seedApp may take.
    if (testInfo.timeout && !seedSnapshot.has(seeded))
      testInfo.setTimeout(testInfo.timeout + 120_000);
    await provide(await seedSnapshot.get(seeded));
  },
});
