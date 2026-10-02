import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';

/**
 * Layout screenshots with the shared, seeded test data of the Dev-Preview build (src/core/seed). Not part of CI (see playwright.screens.config.ts).
 * Output directory: SCREENS_DIR (default test-results/screens/current).
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/current';
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '3440x1440', width: 3440, height: 1440 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];
/** SCREENS_DESKTOP=1 poses as the desktop app (E2E builds only) to include the desktop-only modules. */
/** Optional filters for quick iterations, e.g. SCREENS_VIEWPORTS=1920x1080 SCREENS_PAGES=calendar; SCREENS_SCHEME=dark. */
const ONLY_VIEWPORTS = process.env.SCREENS_VIEWPORTS?.split(',');
const ONLY_PAGES = process.env.SCREENS_PAGES ? new RegExp(process.env.SCREENS_PAGES) : undefined;
/** Demo vault passphrase of the seed (modules/accounts/seed.ts). */
const MASTER = 'nemo-demo-tresor'; // gitleaks:allow (invented demo value)
/** Size of the shared test data (src/core/seed): `small` is what E2E uses, screenshots look better with `medium`. */
const SCALE = (process.env.SCREENS_SCALE as 'small' | 'medium' | 'large' | undefined) ?? 'medium';

const PAGES: { name: string; path: string }[] = [
  { name: 'dashboard', path: '/' },
  { name: 'calendar-month', path: `/calendar?view=month&date=${SEED_TODAY}` },
  { name: 'calendar-week', path: `/calendar?view=week&date=${SEED_TODAY}` },
  { name: 'calendar-day', path: `/calendar?view=day&date=${SEED_TODAY}` },
  { name: 'todos', path: '/todos' },
  { name: 'reminders', path: '/calendar?tab=reminders' },
  { name: 'finance-overview', path: '/finance?tab=overview' },
  { name: 'finance-transactions', path: '/finance?tab=transactions' },
  { name: 'invoices', path: '/invoices' },
  { name: 'subscriptions', path: '/subscriptions' },
  { name: 'bookmarks', path: '/bookmarks' },
  { name: 'bookmarks-links', path: '/bookmarks?view=links' },
  { name: 'notes', path: '/notes' },
  { name: 'lists', path: '/lists' },
  { name: 'budgets', path: '/budgets' },
  { name: 'vault', path: '/vault' },
  { name: 'pantry', path: '/pantry' },
  { name: 'people', path: '/people' },
  ...(process.env.SCREENS_DESKTOP
    ? [
        { name: 'system', path: '/disk?tab=system' },
        { name: 'disk', path: '/disk' },
      ]
    : []),
  { name: 'components', path: '/dev/components' },
  { name: 'library', path: '/library' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-allgemein', path: '/settings/allgemein' },
  { name: 'settings-darstellung', path: '/settings/darstellung' },
  { name: 'settings-module', path: '/settings/module' },
  { name: 'settings-sicherheit', path: '/settings/sicherheit' },
  { name: 'settings-sync', path: '/settings/sync' },
  { name: 'settings-ki', path: '/settings/ki' },
  { name: 'settings-verbindungen', path: '/settings/verbindungen' },
  { name: 'settings-ueber', path: '/settings/ueber' },
];

/** The desktop-only module is off by default: switch it on in IndexedDB (the app has opened the DB by now). */
async function enableDisk(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'disk',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'screens',
            deletedAt: null,
            _f: {},
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('capture layout screenshots', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS.filter((v) => !ONLY_VIEWPORTS || ONLY_VIEWPORTS.includes(v.name))) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile ?? false,
      hasTouch: vp.mobile ?? false,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: (process.env.SCREENS_SCHEME as 'light' | 'dark') ?? 'light',
    });
    const page = await context.newPage();
    if (process.env.SCREENS_DESKTOP)
      await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
    await bootDev(page);
    await seedApp(page, SCALE);
    if (process.env.SCREENS_DESKTOP) await enableDisk(page);
    for (const p of PAGES.filter((x) => !ONLY_PAGES || ONLY_PAGES.test(x.name))) {
      await page.goto(p.path);
      await expect(page.locator('main')).toBeVisible();
      // Design experiments: SCREENS_CSS=<file> injects a stylesheet (token overrides) before the shot.
      if (process.env.SCREENS_CSS) await page.addStyleTag({ path: process.env.SCREENS_CSS });
      // The one-time Dev-Preview notice appears after every full load: close it for the shot.
      const notice = page.getByRole('button', { name: 'Schließen', exact: true });
      if (await notice.count()) await notice.first().click();
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `${OUT}/${vp.name}--${p.name}.png`,
        fullPage: p.name === 'dashboard',
      });
    }
    if (ONLY_PAGES && !ONLY_PAGES.test('accounts')) {
      await context.close();
      continue;
    }
    // Unlocked vault list (the session key is in memory only, so use client-side navigation).
    await page.goto('/accounts');
    await page.waitForTimeout(300);
    await page.getByLabel('Master-Passwort').fill(MASTER);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${OUT}/${vp.name}--accounts.png` });
    await context.close();
  }
});
