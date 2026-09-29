import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

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
];

/** Enables every module (raw write into the module table, like the library would do). */
async function enableAll(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ids) {
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
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    MODULES,
  );
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes
        .slice(0, 3)
        .map((n) => `   ${n.target.join(' ')}\n   ${n.failureSummary?.split('\n')[1] ?? ''}`)
        .join('\n')}`,
  );
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
}

const PAGES = [
  ['dashboard', '/'],
  ['library', '/library'],
  ['settings', '/settings'],
  ['calendar', '/calendar'],
  ['todos', '/todos'],
  ['reminders', '/reminders'],
  ['finance', '/finance'],
  ['finance transactions', '/finance?tab=transactions'],
  ['invoices', '/invoices'],
  ['subscriptions', '/subscriptions'],
  ['bookmarks', '/bookmarks'],
  ['notes', '/notes'],
  ['shopping', '/shopping'],
  ['birthdays', '/birthdays'],
  ['habits', '/habits'],
  ['contracts', '/contracts'],
  ['budgets', '/budgets'],
  ['budgets goals', '/budgets?tab=goals'],
  ['packing', '/packing'],
  ['vault', '/vault'],
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await enableAll(page);
    });

    for (const [name, url] of PAGES) {
      test(`page: ${name}`, async ({ page }) => {
        await page.goto(url);
        await expect(page.locator('main h1')).toBeVisible();
        await audit(page, `${name} (${scheme})`);
      });
    }

    test('dialogs: command palette, quick add, create forms', async ({ page }) => {
      await page.goto('/');
      await page.locator('header button', { hasText: 'Suchen' }).click();
      await expect(page.getByRole('combobox')).toBeVisible();
      await audit(page, `palette (${scheme})`);
      await page.getByRole('combobox').fill('Was steht heute an?');
      await page.getByRole('combobox').press('Enter');
      await expect(page.getByTestId('ai-answer')).toBeVisible();
      await audit(page, `assistant answer (${scheme})`);
      await page.keyboard.press('Escape');

      for (const url of [
        '/invoices?new=1',
        '/bookmarks?new=1',
        '/notes?new=1',
        '/contracts?new=1',
        '/vault?new=1',
        '/habits?new=1',
        '/birthdays?new=1',
        '/budgets?tab=goals&new=1',
        '/reminders?new=1',
      ]) {
        await page.goto(url);
        await expect(page.getByRole('dialog'), url).toBeVisible();
        await audit(page, `${url} (${scheme})`);
      }
    });
  });
}

test('the audit really detects problems', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => {
    document
      .querySelector('main')
      ?.insertAdjacentHTML('beforeend', '<img src="x.png"><button></button>');
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual(
    expect.arrayContaining(['image-alt', 'button-name']),
  );
});
