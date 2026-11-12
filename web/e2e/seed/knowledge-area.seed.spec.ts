import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The knowledge area after package 0b-6 of UI audit 2026-11, first half (Merkliste, Notizen, Chat, Feeds, Mail, Musik):
 * the same reader as the plan area (`planArea.ts`: tone steps, content from y ≤ 220 px on the phone, tabs for the
 * views, one action in the head, nothing cut, rows 48 px on the phone and 44 px on the desktop).
 *
 * Musik is the area's stage and Notizen has no measurable first content on the phone besides its list (PACKAGES 0b-2
 * names both as exceptions of "content from y ≤ 220 px"); Musik is therefore checked on the desktop only, and for its
 * surfaces only in `knowledge-surfaces` below. Mail exists in the desktop app only.
 *
 * `PLAN_SHOTS=<dir>` also writes a picture of every checked first screen (for the pull request).
 */
const PAGES: PageRule[] = [
  { path: '/bookmarks', colouredMax: 10, tabsMin: 2, figure: false, action: true },
  { path: '/bookmarks?view=links', colouredMax: 10, tabsMin: 2, figure: false, action: true },
  { path: '/notes', colouredMax: 10, tabsMin: 0, figure: false, action: true },
  { path: '/chat', colouredMax: 10, tabsMin: 0, figure: false, action: true },
  { path: '/feeds', colouredMax: 10, tabsMin: 0, figure: false, action: true },
];
const DESKTOP_ONLY: PageRule[] = [
  { path: '/mail', colouredMax: 10, tabsMin: 0, figure: false, action: true },
  { path: '/music', colouredMax: 10, tabsMin: 0, figure: false, action: false },
];

for (const theme of process.env.PLAN_SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`knowledge area on tone steps (Identity 4.0, package 0b-6), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('six pages: no frames, one action, nothing cut', async ({ page }) => {
        await startSeeded(page);
        const seen: Record<string, unknown> = {};
        for (const rule of [...PAGES, ...DESKTOP_ONLY])
          seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme });
        console.log(`knowledge area desktop ${theme}: ${JSON.stringify(seen)}`);
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
        console.log(`knowledge area phone ${theme}: ${JSON.stringify(seen)}`);
      });
    });
  });
}
