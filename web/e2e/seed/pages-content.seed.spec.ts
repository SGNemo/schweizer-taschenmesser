import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, test } from './helpers';

/**
 * Load robustness (UI audit 2026-11, package 0a-2): on the seeded Dev-Preview build every module route shows its
 * page, never a lasting "…". Three variants per route: the page's code arrives (content within 3 s), it fails to
 * load (the card with "Neu laden" from the module error boundary), it never answers (the same card after 4 s from
 * the loading fallback, layout/PageLoadingCard). Desktop-only modules run here without their native backend; the
 * native check stays the hand test (docs/MANUAL-TESTS.md).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../src/modules');

/** Every module with a manifest (not the dev-only example) and its routes without a parameter. */
const MODULE_IDS = readdirSync(MODULES)
  .filter((id) => id !== 'example' && existsSync(join(MODULES, id, 'manifest.ts')))
  .sort();
const routesOf = (id: string): string[] => {
  const source = readFileSync(join(MODULES, id, 'manifest.ts'), 'utf8');
  return [...new Set([...source.matchAll(/\bpath: '(\/[^':]*)'/g)].map((m) => m[1]!))];
};
const ROUTES = MODULE_IDS.flatMap(routesOf);

async function enableModules(page: Page, ids: readonly string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
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
    ids,
  );
}

/** The seeded app as the desktop, every module on (the setup of the stimulus measurement). */
async function start(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('tm-show-preview', '1');
    localStorage.setItem('__tmPlatformKind', 'desktop');
  });
  await bootDev(page);
  await page.goto('/settings/entwickler');
  await expect(page.getByTestId('seed-status')).toContainText(SEED_TODAY);
  await enableModules(page, MODULE_IDS);
}

/** Start page of the app with only its own code loaded: no module page was opened yet. */
async function home(page: Page) {
  await page.goto('/settings/darstellung');
  await expect(page.locator('main h1')).toBeVisible();
}

/** Route change inside the app (no reload), the way a click in the navigation does it. */
const navigate = (page: Page, path: string) =>
  page.evaluate((to) => {
    history.pushState({}, '', to);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);

const dots = (page: Page) => page.locator('main [role=status]').filter({ hasText: /^…$/ });
const card = (page: Page) => page.getByTestId('page-loading-card');

test.use({ seeded: { scale: 'small', desktop: true, preview: true } });

test('every module has a route to check', () => {
  for (const id of MODULE_IDS) expect(routesOf(id), id).toContain(`/${id}`);
});

test('every module route shows its page within 3 s', async ({ page }) => {
  test.setTimeout(240_000);
  await start(page);
  for (const path of ROUTES) {
    await home(page);
    await navigate(page, path);
    await expect(page.locator('main h1').first(), path).toBeVisible({ timeout: 3_000 });
    await expect(dots(page), `${path}: still "…"`).toHaveCount(0);
    await expect(card(page), `${path}: loading card although the page arrived`).toHaveCount(0);
    await expect(page.getByTestId('module-error'), `${path}: error card`).toHaveCount(0);
  }
});

test('page code that fails to load: the card with "Neu laden", never "…"', async ({ page }) => {
  test.setTimeout(240_000);
  await start(page);
  for (const path of ROUTES) {
    await home(page);
    // From here on no script arrives: what the app did not load yet fails (offline, stale page after an update).
    await page.route('**/assets/*.js', (route) => route.abort());
    await navigate(page, path);
    await expect(card(page), path).toBeVisible({ timeout: 3_000 });
    await expect(card(page).getByRole('button', { name: 'Neu laden' }), path).toBeVisible();
    await expect(dots(page), `${path}: still "…"`).toHaveCount(0);
    await expect(page.getByTestId('module-error'), `${path}: error card`).toHaveCount(0);
    await page.unroute('**/assets/*.js');
  }
});

// The hanging variant waits 4 s per route: three tests share the routes so they run side by side.
const PARTS = 3;
for (let part = 0; part < PARTS; part++) {
  test(`page code that never answers: the card after 4 s (part ${part + 1}/${PARTS})`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await start(page);
    for (const path of ROUTES.filter((_, i) => i % PARTS === part)) {
      await home(page);
      // The request stays open: neither an answer nor an error (what a blocked main thread of the desktop app does).
      await page.route('**/assets/*.js', () => {});
      await navigate(page, path);
      await expect(dots(page), `${path}: "…" first`).toHaveCount(1);
      await expect(card(page), path).toBeVisible({ timeout: 10_000 });
      await expect(card(page).getByRole('button', { name: 'Neu laden' }), path).toBeVisible();
      await expect(dots(page), `${path}: still "…"`).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}

test('"Neu laden" on the card brings the page once its code arrives again', async ({ page }) => {
  await start(page);
  await home(page);
  await page.route('**/assets/*.js', (route) => route.abort());
  await navigate(page, '/todos');
  await expect(card(page)).toBeVisible();
  await page.unroute('**/assets/*.js');
  await card(page).getByRole('button', { name: 'Neu laden' }).click();
  await expect(page.locator('main h1')).toHaveText(/ToDos/);
  await expect(card(page)).toHaveCount(0);
});
