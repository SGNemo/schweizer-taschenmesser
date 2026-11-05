import { expect, test, type Page } from '@playwright/test';
import { mainNav, ready } from './helpers';

/**
 * The topbar keeps its box: no change of height or position on navigation and scroll on the desktop, and on the
 * phone a bar that was folded while reading is simply there on the next page (no empty band, no slide-in).
 */

interface Sample {
  path: string;
  /** The page heading differs from the one when recording started: the new page is on screen (the URL changes first). */
  fresh: boolean;
  top: number;
  height: number;
  width: number;
  opacity: string;
}

/** Records the topbar's box in every frame from now on (`window.__bar`). */
async function recordBar(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __bar: Sample[]; __barStop?: boolean };
    w.__bar = [];
    w.__barStop = false;
    const title = () => document.querySelector('main h1')?.textContent ?? null;
    const first = title();
    const tick = () => {
      const h = [...document.querySelectorAll('header')].find((x) => !x.closest('main'));
      if (h) {
        const r = h.getBoundingClientRect();
        const now = title();
        w.__bar.push({
          path: location.pathname,
          fresh: now !== null && now !== first,
          top: Math.round(r.top),
          height: Math.round(r.height),
          width: Math.round(r.width),
          opacity: getComputedStyle(h).opacity,
        });
      }
      if (!w.__barStop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const samples = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __bar: Sample[]; __barStop?: boolean };
    w.__barStop = true;
    return w.__bar;
  });

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a bar folded while reading is in place on the next page at once', async ({ page }) => {
    await ready(page, '/library');
    const bar = page.getByRole('banner');
    const before = await bar.boundingBox();
    // Read down the long page until the bar has folded away.
    for (let i = 0; i < 6; i++) await page.evaluate(() => window.scrollBy(0, 250));
    await expect(bar).toHaveAttribute('data-collapsed', 'true');

    await recordBar(page);
    await mainNav(page).getByRole('link', { name: 'Übersicht' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(400);
    const onNewPage = (await samples(page)).filter((s) => s.fresh);
    expect(onNewPage.length).toBeGreaterThan(3);
    // Every frame of the new page: the bar at the top, fully visible, same box as before reading.
    for (const s of onNewPage) {
      expect(s, 'topbar frame on the new page').toEqual({
        path: '/',
        fresh: true,
        top: 0,
        height: Math.round(before!.height),
        width: Math.round(before!.width),
        opacity: '1',
      });
    }
    // Scrolling down still folds it with the slide (the route change only skipped the animation once).
    for (let i = 0; i < 4; i++) await page.evaluate(() => window.scrollBy(0, 150));
    await expect(bar).toHaveAttribute('data-collapsed', 'true');
    await expect(bar).not.toHaveAttribute('data-instant', 'true');
  });
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the topbar box stays the same across navigation and scroll (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page, '/todos');
      const bar = page.getByRole('banner');
      const first = await bar.boundingBox();
      expect(first).not.toBeNull();
      await recordBar(page);
      for (const name of ['Kalender', 'Finanzen', 'Übersicht', 'Notizen', 'ToDos']) {
        const link = mainNav(page).getByRole('link', { name, exact: true });
        if ((await link.count()) === 0) continue; // module not on in a fresh profile
        await link.first().click();
        await expect(page.locator('main h1').first()).toBeVisible();
        await page.locator('#main').evaluate((m) => m.scrollBy(0, 600));
        await page.waitForTimeout(150);
      }
      const all = await samples(page);
      expect(all.length).toBeGreaterThan(10);
      const boxes = new Set(all.map((s) => `${s.top}|${s.height}|${s.width}|${s.opacity}`));
      expect([...boxes]).toEqual([
        `${Math.round(first!.y)}|${Math.round(first!.height)}|${Math.round(first!.width)}|1`,
      ]);
    });
  }
});
