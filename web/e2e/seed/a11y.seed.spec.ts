import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, moduleRoutes, openPage, PHONE, startSeeded } from './guards';

/**
 * axe on the seeded Dev-Preview build (UI audit 2026-11, package 0a-1b): `e2e/a11y.spec.ts` checks the pages without
 * data, where a contrast problem inside a row, a chip or a tinted line never shows. Here every module page, the
 * overview and the library carry the test data, in both themes, on the desktop and at 412 × 915.
 */
/**
 * No known case is left: the entry lines of the calendar's month view were under 24 px high until package 0b-4 of the
 * 4.0 plan (WCAG 2.5.8 `target-size`); they measure 24 px now and the exception for them is gone. Never add one for
 * new code.
 */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes
        .slice(0, 3)
        .map((n) => `   ${n.target.join(' ')}\n   ${n.failureSummary?.split('\n')[1] ?? ''}`)
        .join('\n')}`,
  );
}

for (const vp of [
  { name: 'desktop', size: DESKTOP, phone: false },
  { name: 'phone', size: PHONE, phone: true },
] as const) {
  test.describe(`axe on the seeded build, ${vp.name}`, () => {
    test.use({
      viewport: vp.size,
      isMobile: vp.phone,
      hasTouch: vp.phone,
      seeded: { scale: 'small', desktop: !vp.phone, preview: true },
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`no violations with test data (${scheme})`, async ({ page }) => {
        test.setTimeout(420_000);
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await startSeeded(page, { phone: vp.phone });
        for (const path of ['/', '/library', ...moduleRoutes(vp.phone)]) {
          await openPage(page, path);
          const found = await violations(page);
          // Soft: every page reports before the test fails.
          expect.soft(found, `${path}\n${found.join('\n')}`).toEqual([]);
        }
      });
    }
  });
}
