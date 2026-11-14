import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';
import { settingsSearch } from './settingsSearch';

/**
 * Phone settings: the search is an icon in the title line (0b-E); its field sits flush under the top bar while the
 * page scrolls and follows the bar when it folds away.
 */
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const boxes = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[data-topbar]')!.getBoundingClientRect();
    const search = document.querySelector('[role=search]')!.getBoundingClientRect();
    return { barBottom: bar.bottom, searchTop: search.top };
  });

test('the settings search never hangs in the air below a folded top bar', async ({ page }) => {
  // A long tab: "Darstellung" is shorter than two screens since its head became one line (package 0b-E).
  await ready(page, '/settings/allgemein');
  // Open, then reading on: the bar keeps its place while the cursor is in a field (useTopbarCollapse).
  await (await settingsSearch(page)).blur();
  const bar = page.locator('[data-topbar]');
  const scrollTo = (y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
  // The category's sections load lazily: scroll once the page is taller than the screen.
  await expect
    .poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight))
    .toBeGreaterThan(1300);
  await scrollTo(150);
  await scrollTo(400);
  await expect(bar).toHaveAttribute('data-collapsed', 'true');
  // Folded: the search moves up to the top edge (no band of content above it).
  await expect.poll(async () => (await boxes(page)).searchTop).toBeLessThanOrEqual(1);
  await scrollTo(300);
  await expect(bar).not.toHaveAttribute('data-collapsed', 'true');
  // Back: flush under the bar (at most its 1 px hairline overlaps), no gap.
  await expect
    .poll(async () => {
      const b = await boxes(page);
      return Math.abs(b.searchTop - b.barBottom);
    })
    .toBeLessThanOrEqual(1);
});

test('the search is a 44 px icon in the title line; a tap puts the cursor in the field', async ({
  page,
}) => {
  for (const [path, head] of [
    ['/settings', 'settings-head'],
    ['/settings/darstellung', 'settings-head-darstellung'],
    ['/settings/module/todos', 'module-settings-head'],
  ] as const) {
    await ready(page, path);
    const toggle = page
      .getByTestId(head)
      .getByRole('button', { name: 'Einstellungen durchsuchen' });
    await expect(toggle).toBeVisible();
    // No field of its own above the head any more: the page starts with its title.
    await expect(page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' })).toHaveCount(0);
    const box = (await toggle.boundingBox())!;
    expect(box.width, path).toBeGreaterThanOrEqual(44);
    expect(box.height, path).toBeGreaterThanOrEqual(44);
    // In the head, never over the title (beside it, or at the end of the status head's title row).
    const h1 = (await page.locator('main h1').boundingBox())!;
    const apart =
      box.x >= h1.x + h1.width - 1 ||
      box.y + box.height <= h1.y + 1 ||
      box.y >= h1.y + h1.height - 1;
    expect(apart, path).toBe(true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }

  await ready(page, '/settings/darstellung');
  const toggle = page.getByTestId('settings-search-toggle');
  await toggle.tap();
  const field = page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' });
  await expect(field).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAttribute('aria-controls', 'settings-search');
  // Escape in the empty field closes it and gives the focus back to the icon.
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // A hit leads to its setting and the field closes behind it.
  await toggle.tap();
  await field.fill('dunkel');
  await page.getByRole('search').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/settings\/darstellung#/);
  await expect(field).toHaveCount(0);
  // The focus lands on the icon of the new head, not on <body>.
  await expect(page.getByTestId('settings-search-toggle')).toBeFocused();
});
