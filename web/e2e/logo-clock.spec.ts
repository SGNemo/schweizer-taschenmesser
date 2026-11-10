import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openAppearanceGroup, ready } from './helpers';

/**
 * The time next to the Nemo logo: right of the wordmark in the sidebar head, "14"/"07" under the mark of the
 * folded sidebar, off by default on the phone (the status bar shows the time), and gone when switched off.
 * The e2e build is the PWA (default off), so the desktop cases switch it on like the desktop app's default.
 */

const clockOn = (page: Page) =>
  page.addInitScript(() => {
    if (!sessionStorage.getItem('clock-set')) {
      localStorage.setItem('tm-clock', '1');
      sessionStorage.setItem('clock-set', '1');
    }
  });

test.describe('desktop (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('the clock sits right of the wordmark, centred on it, and turns at the full minute', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-29T14:07:58') });
    await clockOn(page);
    await ready(page, '/');
    const sidebar = page.getByTestId('sidebar');
    const clock = sidebar.getByTestId('logo-clock');
    await expect(clock).toHaveText('14:07');
    await expect(clock).toHaveAttribute('datetime', '14:07');
    await expect(clock).toHaveAttribute('aria-label', 'Uhrzeit 14:07');
    const logo = sidebar.getByRole('link', { name: /Startseite|Übersicht/ }).first();
    const [l, c] = [await logo.boundingBox(), await clock.boundingBox()];
    expect(c!.x).toBeGreaterThanOrEqual(l!.x + l!.width);
    expect(Math.abs(c!.y + c!.height / 2 - (l!.y + l!.height / 2))).toBeLessThanOrEqual(2);
    // Inside the sidebar, no overflow, no click target.
    const s = (await sidebar.boundingBox())!;
    expect(c!.x + c!.width).toBeLessThanOrEqual(s.x + s.width);
    await expect(clock.locator('xpath=ancestor::a')).toHaveCount(0);
    const width = c!.width;
    await page.clock.runFor(2_000);
    await expect(clock).toHaveText('14:08');
    expect((await clock.boundingBox())!.width).toBe(width);
  });

  test('a 12-hour format ("02:07 PM") still fits next to the wordmark; the folded rail shows the digits only', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-09-29T14:07:10') });
    await clockOn(page);
    await page.addInitScript(() => {
      localStorage.setItem('tm-lang', 'en');
      localStorage.setItem('tm-format', 'en-US');
    });
    await ready(page, '/');
    const sidebar = page.getByTestId('sidebar');
    const clock = sidebar.getByTestId('logo-clock');
    await expect(clock).toHaveAttribute('aria-label', /^Time 0?2:07\sPM$/);
    const inner = await sidebar.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.right - parseFloat(getComputedStyle(el).paddingRight);
    });
    const c = (await clock.boundingBox())!;
    expect(c.x + c.width).toBeLessThanOrEqual(inner);
    await page.evaluate(() => localStorage.setItem('tm-sidebar', 'narrow'));
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    const folded = sidebar.getByTestId('logo-clock');
    await expect(folded).toHaveText(/^0?2:07$/);
    await expect(folded).toHaveAttribute('aria-label', /^Time 0?2:07\sPM$/);
    const [s, f] = [(await sidebar.boundingBox())!, (await folded.boundingBox())!];
    expect(f.x).toBeGreaterThanOrEqual(s.x);
    expect(f.x + f.width).toBeLessThanOrEqual(s.x + s.width);
  });

  test('folded: one line under the tile, without overflow', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-29T14:07:10') });
    await clockOn(page);
    await page.addInitScript(() => localStorage.setItem('tm-sidebar', 'narrow'));
    await ready(page, '/');
    const sidebar = page.getByTestId('sidebar');
    const clock = sidebar.getByTestId('logo-clock');
    await expect(clock).toBeVisible();
    await expect(clock).toHaveText('14:07');
    const [s, c] = [(await sidebar.boundingBox())!, (await clock.boundingBox())!];
    // The tile sits on whole pixels inside the rail, the time right under it.
    const tile = (await sidebar
      .getByRole('link', { name: /Startseite|Übersicht/ })
      .first()
      .locator('svg')
      .boundingBox())!;
    expect(tile.width).toBe(tile.height);
    expect(Number.isInteger(tile.x) && Number.isInteger(tile.y)).toBe(true);
    expect(tile.x).toBeGreaterThanOrEqual(s.x);
    expect(tile.x + tile.width).toBeLessThanOrEqual(s.x + s.width);
    expect(c.y).toBeGreaterThanOrEqual(tile.y + tile.height);
    expect(c.x).toBeGreaterThanOrEqual(s.x);
    expect(c.x + c.width).toBeLessThanOrEqual(s.x + s.width);
    expect(await clock.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('switched off in Darstellung, the clock is gone', async ({ page }) => {
    await clockOn(page);
    await ready(page, '/settings/darstellung');
    await expect(page.getByTestId('sidebar').getByTestId('logo-clock')).toBeVisible();
    await openAppearanceGroup(page, 'other');
    const sw = page.getByRole('switch', { name: 'Uhrzeit neben dem Logo' });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(page.getByTestId('logo-clock')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByTestId('logo-clock')).toHaveCount(0);
  });

  test('AA contrast in light and dark, with every supporter colour theme, open and folded', async ({
    page,
  }) => {
    await clockOn(page);
    await ready(page, '/');
    for (const sidebar of ['wide', 'narrow']) {
      await page.evaluate((v) => localStorage.setItem('tm-sidebar', v), sidebar);
      await page.reload();
      await expect(page.getByTestId('sidebar').getByTestId('logo-clock')).toBeVisible();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        for (const palette of ['', 'korallenriff', 'tiefsee', 'sand', 'nordlicht', 'monochrom']) {
          await page.evaluate((p) => {
            if (p) document.documentElement.dataset.palette = p;
            else delete document.documentElement.dataset.palette;
          }, palette);
          const r = await new AxeBuilder({ page })
            .include('[data-testid="sidebar"] [data-testid="logo-clock"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            r.violations.map((v) => v.id),
            `${sidebar} ${scheme} ${palette}`,
          ).toEqual([]);
        }
      }
    }
  });

  test('the settings search finds it as "uhr" and "clock"', async ({ page }) => {
    await ready(page, '/settings');
    for (const q of ['uhr', 'clock']) {
      const search = page.getByRole('searchbox').first();
      await search.fill(q);
      await expect(page.getByText('Uhrzeit neben dem Logo').first()).toBeVisible();
    }
  });
});

test.describe('phone (412 px)', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test('off by default; switched on it sits next to the logo in the top bar', async ({ page }) => {
    await ready(page, '/');
    await expect(page.getByTestId('logo-clock')).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('tm-clock', '1'));
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    const bar = page.locator('header[data-topbar]');
    const clock = bar.getByTestId('logo-clock');
    await expect(clock).toBeVisible();
    const [l, c] = [
      (await bar.getByRole('link').first().boundingBox())!,
      (await clock.boundingBox())!,
    ];
    expect(c.x).toBeGreaterThanOrEqual(l.x + l.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      412,
    );
  });
});
