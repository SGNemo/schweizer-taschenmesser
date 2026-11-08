import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Phone settings: the sticky search sits flush under the top bar and follows it when the bar folds away. */
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const boxes = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[data-topbar]')!.getBoundingClientRect();
    const search = document.querySelector('[role=search]')!.getBoundingClientRect();
    return { barBottom: bar.bottom, searchTop: search.top };
  });

test('the settings search never hangs in the air below a folded top bar', async ({ page }) => {
  await ready(page, '/settings/darstellung');
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
