import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The plan area after package 0b-4 of UI audit 2026-11, second part (0b-4b, list pages: Personen, Gewohnheiten,
 * Zeiterfassung, Uhr): see `planArea.ts` for what a page has to hold. Personen, Gewohnheiten and Zeiterfassung are
 * master–detail on a wide page (the maintainer's answer after 0b-4a: no reading column that leaves the window empty).
 * Zeiterfassung: "Start" in the page is its one filled button (C29), so the head's entry is not filled (`action: false`
 * skips the filled-button and plus checks of the helper; the plus is checked below).
 */
const PAGES: PageRule[] = [
  { path: '/people', colouredMax: 10, tabsMin: 2, figure: true, action: true },
  { path: '/habits', colouredMax: 10, tabsMin: 3, figure: true, action: true },
  // The year grid is a picture of data: a cell per day in the goal's colour, with a legend in words.
  { path: '/habits?view=history', colouredMax: 130, tabsMin: 3, figure: true, action: true },
  { path: '/timetrack', colouredMax: 10, tabsMin: 3, figure: true, action: false },
  { path: '/timetrack?view=report', colouredMax: 10, tabsMin: 3, figure: true, action: false },
  { path: '/timetrack?view=jobs', colouredMax: 10, tabsMin: 3, figure: true, action: false },
  { path: '/clock', colouredMax: 10, tabsMin: 0, figure: true, action: true },
];

for (const theme of process.env.PLAN_SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`plan area, list pages on tone steps (package 0b-4b), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('four pages: no frames, tabs, one action, nothing cut', async ({ page }) => {
        await startSeeded(page);
        const seen: Record<string, unknown> = {};
        for (const rule of PAGES)
          seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme });
        console.log(`plan lists desktop ${theme}: ${JSON.stringify(seen)}`);
      });

      test('master–detail: a row shows its entry in the panel beside the list', async ({
        page,
      }) => {
        await startSeeded(page);
        for (const [path, panel] of [
          ['/people', 'person-detail'],
          ['/habits', 'habit-detail'],
          ['/timetrack', 'session-detail'],
        ] as const) {
          await openPage(page, path);
          // The first row is shown from the start and marked in the list; no dialog opens.
          await expect(page.getByTestId(panel), path).toBeVisible();
          await expect(page.locator('main [aria-current="true"]'), path).toHaveCount(1);
          await expect(page.getByRole('dialog'), path).toHaveCount(0);
          // "Bearbeiten" in the panel is the way into the entry's dialog.
          await page.getByTestId(panel).getByRole('button', { name: 'Bearbeiten' }).click();
          await expect(page.getByRole('dialog'), path).toBeVisible();
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('four pages: content from y ≤ 220 px, plus is the action, nothing cut', async ({
        page,
      }) => {
        await startSeeded(page, { phone: true });
        const seen: Record<string, unknown> = {};
        for (const rule of PAGES)
          seen[rule.path] = await checkPlanPage(page, rule, { phone: true, theme });
        console.log(`plan lists phone ${theme}: ${JSON.stringify(seen)}`);
        // Zeiterfassung: the plus adds a past entry, "Start" stays the page's own button.
        await openPage(page, '/timetrack');
        await expect(page.getByTestId('bottom-plus')).toHaveAccessibleName('Zeit eintragen');
      });
    });
  });
}
