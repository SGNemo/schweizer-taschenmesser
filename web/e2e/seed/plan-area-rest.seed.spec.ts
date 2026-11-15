import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The plan area after package 0b-4 of UI audit 2026-11, last part (0b-4b part 2: Planer, Karten & Orte, Wetter): see
 * `planArea.ts` for what a page has to hold. Planer (planner hub R1, decisions D2/D3 in `docs/decisions/plan-hub.md`):
 * the week is a band of seven tiles, the picked day's sheet lies below it, and the inline field is the first thing
 * of the main column on the desktop, so it has no head action (`action: false`). Wetter is a stage: its height with
 * weather data is measured in `head-height.seed.spec.ts`.
 */
const PAGES: PageRule[] = [
  { path: '/planner', colouredMax: 10, tabsMin: 0, figure: true, action: false },
  { path: '/maps', colouredMax: 10, tabsMin: 3, figure: true, action: true },
  { path: '/maps?view=routes', colouredMax: 10, tabsMin: 3, figure: true, action: true },
];

test.describe('plan area, Planer and Karten on tone steps (package 0b-4b, part 2)', () => {
  test.setTimeout(180_000);

  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
    test('no frames, tabs, one action, nothing cut', async ({ page }) => {
      await startSeeded(page);
      const seen: Record<string, unknown> = {};
      for (const rule of PAGES)
        seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme: 'light' });
      console.log(`plan rest desktop: ${JSON.stringify(seen)}`);
    });

    test("Planer: the week is a band of seven tiles, the picked day's sheet lies below it, the field comes first", async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/planner');
      const band = page.locator('main [role="group"][aria-label="Woche"]');
      const days = band.locator('[data-testid^="week-"]');
      await expect(days).toHaveCount(7);
      await expect(band.locator('[aria-pressed="true"]')).toHaveCount(1);
      const sheets = page.locator('main [data-testid^="day-"][aria-labelledby]');
      await expect(sheets).toHaveCount(1);
      // Another day is one click; the sheet follows.
      const second = days.nth(1);
      const id = (await second.getAttribute('data-testid'))!.replace('week-', 'day-');
      await second.click();
      await expect(page.locator('main').getByTestId(id)).toBeVisible();
      await expect(sheets).toHaveCount(1);
      await expect(band.locator('[aria-pressed="true"]')).toHaveAttribute(
        'data-testid',
        id.replace('day-', 'week-'),
      );
      // The sheet lies under the band; the inline field (D3, revising rule 4 for the planner) above both.
      const field = await page.getByLabel('Eintragen oder sagen').boundingBox();
      const week = await band.boundingBox();
      const sheet = await page.locator('main').getByTestId(id).boundingBox();
      expect(sheet!.y).toBeGreaterThanOrEqual(week!.y + week!.height);
      expect(field!.y + field!.height).toBeLessThanOrEqual(week!.y);
    });

    test('Wetter: the stage draws its default signature without a surface (design check K7)', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/weather');
      const mark = page.locator(
        '[data-testid="module-signature"][data-default="true"] span[data-signature]',
      );
      await expect(mark).toBeVisible();
      const drawn = await mark.evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, shadow: s.boxShadow };
      });
      expect(drawn).toEqual({ background: 'rgba(0, 0, 0, 0)', shadow: 'none' });
    });

    test('Karten: an empty list of routes offers its one step', async ({ page }) => {
      await startSeeded(page);
      await openPage(page, '/maps?view=routes');
      // The head's action and the plus name the thing with one verb.
      await expect(
        page.locator('[data-page-action]:visible').filter({ hasText: 'Route eintragen' }),
      ).toHaveCount(1);
    });
  });

  test.describe('phone', () => {
    test.use({
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
      seeded: { scale: 'medium', preview: true },
    });
    test('content from y ≤ 220 px, nothing cut', async ({ page }) => {
      await startSeeded(page, { phone: true });
      const seen: Record<string, unknown> = {};
      for (const rule of PAGES)
        seen[rule.path] = await checkPlanPage(page, rule, { phone: true, theme: 'light' });
      console.log(`plan rest phone: ${JSON.stringify(seen)}`);
      await openPage(page, '/maps');
      await expect(page.getByTestId('bottom-plus')).toHaveAccessibleName('Ort eintragen');
    });
  });
});
