import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, startSeeded } from './guards';

/**
 * Reading aid at run time (UI audit 2026-11, package 0a-1b): with the aid on at 100 % no word start (`[data-rs]`) is
 * marked on the credential screens or on a row elsewhere that shows a vault title (palette hit, reminder). Until now
 * only the route element's type was tested (`router.test.tsx`), so a new place for such a title lost the rule silently.
 */
test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

async function start(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('tm-read-aid', '1');
    localStorage.setItem('tm-read-cover', '100');
  });
  await startSeeded(page);
}

const marks = (page: Page, scope: string) => page.locator(`${scope} [data-rs]`);

test('the aid is really on: an ordinary page marks word starts', async ({ page }) => {
  await start(page);
  await openPage(page, '/todos');
  await expect(marks(page, 'main').first()).toBeAttached();
});

test('no word start is marked on the vault and passwords pages, head included', async ({
  page,
}) => {
  await start(page);
  for (const path of ['/vault', '/accounts']) {
    await openPage(page, path);
    await expect(marks(page, 'main'), path).toHaveCount(0);
  }
});

test('a vault title as a palette hit is not marked, row and subtitle included', async ({
  page,
}) => {
  await start(page);
  await openPage(page, '/todos');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog');
  await expect(palette).toBeVisible();
  // Seed data: a document "Handyvertrag" in the vault.
  await palette.getByRole('combobox').fill('Handyvertrag');
  // The first option offers to ask the assistant about the words typed; the hit is the row that names its module.
  const hit = palette.getByRole('option').filter({ hasText: /Handyvertrag.*Unterlagen/ });
  await expect(hit).toBeVisible();
  await expect(hit.locator('[data-rs]')).toHaveCount(0);
});

// A vault reminder in the notification centre: the test data has none open on its reference day, so that case is a
// component test (src/layout/NotificationCenter.readaid.test.tsx).
