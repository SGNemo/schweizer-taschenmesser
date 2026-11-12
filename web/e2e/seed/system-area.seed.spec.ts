import { test } from './helpers';
import { DESKTOP, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The system area and the browser after package 0b-6 of UI audit 2026-11, second half (Browser, Dieser PC, Downloads):
 * the same reader as the plan area (`planArea.ts`: tone steps, tabs for the views, one action in the head, nothing cut,
 * rows 44 px on the desktop). All three modules exist in the desktop app only (`manifest.platforms`), so there is no
 * phone run; the real windows (web view, drives, downloads) are hand tests in MANUAL-TESTS.
 *
 * `PLAN_SHOTS=<dir>` also writes a picture of every checked first screen (for the pull request).
 */
const PAGES: PageRule[] = [
  { path: '/browser', colouredMax: 10, tabsMin: 0, figure: false, action: false },
  { path: '/disk', colouredMax: 10, tabsMin: 2, figure: true, action: false },
  { path: '/disk/scan', colouredMax: 10, tabsMin: 0, figure: false, action: false },
  { path: '/downloads', colouredMax: 10, tabsMin: 0, figure: false, action: true },
];

for (const theme of process.env.PLAN_SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`system area on tone steps (Identity 4.0, package 0b-6b), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);
    test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
    test('Browser, Dieser PC, Downloads: no frames, one action, nothing cut', async ({ page }) => {
      await startSeeded(page);
      const seen: Record<string, unknown> = {};
      for (const rule of PAGES)
        seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme });
      console.log(`system area desktop ${theme}: ${JSON.stringify(seen)}`);
    });
  });
}
