import { expect, test, type Page } from '@playwright/test';
import { bootDev, seedApp } from './helpers';

const MODULES = [
  'calendar',
  'todos',
  'reminders',
  'finance',
  'invoices',
  'subscriptions',
  'bookmarks',
  'notes',
  'shopping',
  'birthdays',
  'habits',
  'contracts',
  'budgets',
  'packing',
  'vault',
  'news',
  'launcher',
  'pantry',
  'timetrack',
  'gifts',
];

/** Row counts of all tables whose name starts with a module prefix (raw IndexedDB). */
async function countRows(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = [...db.objectStoreNames].filter((n) => !n.startsWith('_'));
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, number> = {};
          for (const n of names) {
            const req = tx.objectStore(n).count();
            req.onsuccess = () => (out[n] = req.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

test.describe('Dev-Preview test data', () => {
  test('dev flavour: load → home and every module show data → remove → empty', async ({ page }) => {
    await bootDev(page);
    await seedApp(page, 'small');

    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    for (const id of ['calendar:today', 'todos:open', 'finance:balance', 'invoices:due'])
      await expect(page.getByTestId(`widget-${id}`)).toBeVisible();
    // No widget falls back to its empty state.
    await expect(page.locator('[data-testid^="widget-"] [class*="emptyTitle"]')).toHaveCount(0);

    for (const id of MODULES) {
      await page.goto(`/${id}`);
      await expect(page.locator('main h1'), id).toBeVisible();
      await expect(page.locator('main h2[class*="emptyTitle"]'), `${id} page is empty`).toHaveCount(
        0,
      );
    }
    expect(total(await countRows(page))).toBeGreaterThan(100);

    await page.goto('/settings');
    const section = page.locator('section[aria-labelledby="developer"]');
    await section.getByTestId('seed-remove').click();
    await expect(section.getByTestId('seed-status')).toHaveCount(0);
    await expect.poll(async () => total(await countRows(page))).toBe(0);
  });

  test('seed data never enters the sync outbox', async ({ page }) => {
    await bootDev(page);
    await seedApp(page, 'small');
    const outbox = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const req = open.result.transaction('_outbox').objectStore('_outbox').count();
            req.onsuccess = () => resolve(req.result);
          };
        }),
    );
    expect(outbox).toBe(0);
  });

  test('first start of an empty dev app fills it and shows the banner', async ({ page }) => {
    await bootDev(page, { autofill: true });
    await page.goto('/');
    await expect(page.getByTestId('seed-banner')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('seed-banner')).toContainText('Testdaten geladen');
    await page.getByRole('button', { name: 'Verstanden' }).click();
    await expect(page.getByTestId('seed-banner')).toHaveCount(0);
    expect(total(await countRows(page))).toBeGreaterThan(300);
  });

  test('"Alles zurücksetzen" needs the typed word and leaves an empty app', async ({ page }) => {
    await bootDev(page);
    await seedApp(page, 'small');
    const section = page.locator('section[aria-labelledby="developer"]');
    const reset = section.getByRole('button', { name: 'Alles zurücksetzen' });
    await expect(reset).toBeDisabled();
    await section.getByLabel('Bestätigung').fill('ZURÜCKSETZEN');
    await reset.click();
    await expect(page.locator('main h1')).toBeVisible();
    await page.goto('/settings');
    await expect(page.locator('section[aria-labelledby="developer"]')).toBeVisible();
    await expect(page.getByTestId('seed-status')).toHaveCount(0);
    expect(total(await countRows(page))).toBe(0);
  });

  test('palette command loads test data', async ({ page }) => {
    await bootDev(page);
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    await page.keyboard.press('Control+k');
    await page
      .getByRole('combobox', { name: 'Suchen, springen oder fragen …' })
      .fill('Testdaten laden');
    await page.getByRole('option', { name: 'Testdaten laden', exact: true }).click();
    await expect
      .poll(async () => total(await countRows(page)), { timeout: 60_000 })
      .toBeGreaterThan(100);
  });
});
