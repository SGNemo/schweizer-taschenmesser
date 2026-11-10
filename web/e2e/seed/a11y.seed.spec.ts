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
 * Violations that exist today and belong to a package of the 4.0 plan (docs/design/ui-audit-2026-11/PACKAGES.md). The
 * list only shrinks: an entry that no longer occurs fails the test until it is removed here. Never add one for new code.
 */
const KNOWN: Readonly<Record<string, readonly string[]>> = {
  // Month view: the entry lines are 18 px high, one pixel apart (WCAG 2.5.8 asks for 24 px or space). Package 0b-4.
  '/calendar': ['target-size'],
};

async function violations(page: Page, path: string): Promise<{ found: string[]; ids: string[] }> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const ids = results.violations.map((v) => v.id);
  const found = results.violations
    .filter((v) => !(KNOWN[path] ?? []).includes(v.id))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n${v.nodes
          .slice(0, 3)
          .map((n) => `   ${n.target.join(' ')}\n   ${n.failureSummary?.split('\n')[1] ?? ''}`)
          .join('\n')}`,
    );
  return { found, ids };
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
          const { found, ids } = await violations(page, path);
          // Soft: every page reports before the test fails.
          expect.soft(found, `${path}\n${found.join('\n')}`).toEqual([]);
          // Only where the known case can show: the month view with its entry lines is the desktop's default.
          if (!vp.phone)
            for (const id of KNOWN[path] ?? [])
              expect.soft(ids, `${path}: "${id}" is gone, remove it from KNOWN`).toContain(id);
        }
      });
    }
  });
}
