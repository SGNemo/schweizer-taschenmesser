import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The plan area after package 0b-4 of UI audit 2026-11, last part (0b-4b part 2: Planer, Karten & Orte, Wetter): see
 * `planArea.ts` for what a page has to hold. Planer is master–detail on a wide page (the week as a list, the picked
 * day beside it) and keeps its inline field as the page's last row (rule 4), so it has no head action
 * (`action: false`). Wetter is a stage: its height with weather data is measured in `head-height.seed.spec.ts`.
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

    test('Planer: the week is a list, the picked day lies beside it, the field is the last row', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/planner');
      const days = page.locator('main [data-testid^="week-"]');
      await expect(days).toHaveCount(7);
      await expect(page.locator('main [aria-current="true"]')).toHaveCount(1);
      const panel = page.locator('main aside');
      await expect(panel.locator('[data-testid^="day-"]')).toHaveCount(1);
      // Another day is one click; the panel follows.
      const second = days.nth(1);
      const id = (await second.getAttribute('data-testid'))!.replace('week-', 'day-');
      await second.click();
      await expect(panel.getByTestId(id)).toBeVisible();
      await expect(
        page.locator('main [aria-current="true"]').getByTestId(id.replace('day-', 'week-')),
      ).toBeVisible();
      // Rule 4: the inline field lies under the week, not above it.
      const field = await page.getByLabel('Eintragen oder sagen').boundingBox();
      const week = await page.locator('main ul[aria-label="Woche"]').boundingBox();
      expect(field!.y).toBeGreaterThan(week!.y + week!.height);
    });

    test('Wetter: the stage draws its default signature without a surface (design check K7)', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/weather');
      const mark = page.locator(
        '[data-testid="module-signature"][data-default="true"] [data-signature]',
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
