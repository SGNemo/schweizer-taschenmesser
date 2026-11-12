import { expect } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
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
  { path: '/downloads', colouredMax: 10, tabsMin: 0, figure: true, action: true },
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

test.describe('settings start page: the states are lines', () => {
  for (const phone of [false, true]) {
    test.describe(phone ? 'phone' : 'desktop', () => {
      test.use(
        phone
          ? {
              viewport: PHONE,
              isMobile: true,
              hasTouch: true,
              seeded: { scale: 'medium', preview: true },
            }
          : { viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } },
      );
      test('six status lines and three overview lines: no frame, nothing cut, a lower head', async ({
        page,
      }) => {
        test.setTimeout(120_000);
        await startSeeded(page, { phone });
        await openPage(page, '/settings');
        const read = await page.evaluate(() => {
          const lines = Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-testid="settings-status"] a, [data-testid="settings-overview"] a',
            ),
          ).filter((el) => el.getBoundingClientRect().height > 0);
          const framed = lines.filter((el) => {
            const s = getComputedStyle(el);
            return (
              parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) > 0 ||
              s.boxShadow !== 'none'
            );
          });
          const cut = lines
            .flatMap((el) => Array.from(el.querySelectorAll('span')))
            .filter((e) => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1)
            .map((e) => e.textContent ?? '');
          return {
            lines: lines.length,
            heights: lines.map((el) => Math.round(el.getBoundingClientRect().height)),
            framed: framed.length,
            cut,
            head: Math.round(
              document.querySelector('[data-testid="settings-head"]')?.getBoundingClientRect()
                .height ?? 0,
            ),
            sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        console.log(`settings start ${phone ? 'phone' : 'desktop'}: ${JSON.stringify(read)}`);
        // The phone lists the categories instead of the three overview lines.
        expect.soft(read.lines, 'status and overview lines').toBe(phone ? 6 : 9);
        expect.soft(read.framed, 'lines with a frame or a shadow').toBe(0);
        expect.soft(read.cut, 'cut text').toEqual([]);
        for (const h of read.heights) {
          expect.soft(h, 'a line is a touch target').toBeGreaterThanOrEqual(44);
          // Name and state on one line, the context below it in one or two small lines.
          expect.soft(h, 'a line stays a line').toBeLessThanOrEqual(104);
        }
        // The head was 368 px (desktop) and 338 px (phone) with the tiles.
        expect.soft(read.head, 'height of the status head').toBeLessThanOrEqual(300);
        expect.soft(read.sideways, 'sideways overflow').toBe(false);
        const m = surfaceMetrics(await page.evaluate(measurePage));
        expect.soft(m.shadows, 'shadows in main').toBe(0);
        if (process.env.PLAN_SHOTS)
          await page.screenshot({
            path: `${process.env.PLAN_SHOTS}/${phone ? 'phone' : 'desktop'}-light-settings.png`,
          });
      });
    });
  }
});
