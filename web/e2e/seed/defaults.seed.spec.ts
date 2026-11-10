import { expect, type Page } from '@playwright/test';
import { bootDev, test } from './helpers';

/**
 * Default set of a fresh installation (UI audit 2026-11, package V-1; logic and its cases: core/modules/defaults.ts,
 * defaults.test.ts). The test builds keep the set off (`VITE_DEFAULTS_OFF=1` in `.env.e2e*`), so every other spec sees
 * the app it was written for; this spec switches it on for its own context and checks what a new device shows, and
 * that nothing of it is written as a household row.
 */
const DESKTOP = { width: 1920, height: 1080 };

async function fresh(page: Page, opts: { set: boolean; desktop: boolean }) {
  await page.addInitScript(({ set, desktop }) => {
    if (set) localStorage.setItem('__tmDefaultsOn', '1');
    if (desktop) localStorage.setItem('__tmPlatformKind', 'desktop');
  }, opts);
  await bootDev(page);
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
}

const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ meta: unknown; rows: number }>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['_meta', '_modules'], 'readonly');
          const meta = tx.objectStore('_meta').get('defaults.version');
          const rows = tx.objectStore('_modules').count();
          tx.oncomplete = () => {
            db.close();
            resolve({
              meta: (meta.result as { value?: unknown } | undefined)?.value,
              rows: rows.result,
            });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

const isOn = (page: Page, id: string) =>
  page.getByTestId(`module-${id}`).getByRole('switch').isChecked();

test.use({ viewport: DESKTOP });

test('a new desktop installation shows lists, budgets and downloads, and writes no module row', async ({
  page,
}) => {
  await fresh(page, { set: true, desktop: true });
  for (const id of ['lists', 'budgets', 'downloads'])
    await expect(page.getByTestId(`module-${id}`).getByRole('switch'), id).toBeChecked();
  // In the navigation too: the areas the audit found invisible on a standard installation.
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  for (const area of ['Haushalt', 'Geld', 'System'])
    await expect(nav.getByText(area, { exact: true }).first(), area).toBeVisible();
  expect(await stored(page)).toEqual({ meta: 4, rows: 0 });
});

test('a new installation in the browser gets lists and budgets; downloads does not exist there', async ({
  page,
}) => {
  await fresh(page, { set: true, desktop: false });
  expect(await isOn(page, 'lists')).toBe(true);
  expect(await isOn(page, 'budgets')).toBe(true);
  await expect(page.getByTestId('module-downloads')).toHaveCount(0);
});

test('the test builds themselves keep the set off: lists and budgets are off as before', async ({
  page,
}) => {
  await fresh(page, { set: false, desktop: true });
  expect(await isOn(page, 'lists')).toBe(false);
  expect(await isOn(page, 'budgets')).toBe(false);
  expect((await stored(page)).meta).toBeUndefined();
});

test('switching a set module off in the library is a household choice: it writes the row', async ({
  page,
}) => {
  await fresh(page, { set: true, desktop: true });
  await page.getByTestId('module-lists').getByRole('switch').click();
  await expect(page.getByTestId('module-lists').getByRole('switch')).not.toBeChecked();
  await expect.poll(async () => (await stored(page)).rows).toBe(1);
});
