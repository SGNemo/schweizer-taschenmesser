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
 * One known case, owned by package 0b-4 of the 4.0 plan (docs/design/ui-audit-2026-11/PACKAGES.md): the entry lines
 * of the calendar's month view are under 24 px high, one pixel apart (WCAG 2.5.8 `target-size`). Only those lines,
 * only on the desktop (the phone shows no month grid), are left out of that one rule. The exception only shrinks: once
 * the lines measure 24 px, the test fails until it is removed here. Never add one for new code.
 */
const MONTH_LINES = 'main table td li > button';
const KNOWN_PATH = '/calendar';

async function violations(page: Page, knownSmall?: string): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  // The known lines are left out of `target-size` only: every other rule (contrast on the calendar's tint first of
  // all) still checks them. A node counts as known when the element axe points at is one of those lines.
  const small = results.violations.find((v) => v.id === 'target-size');
  const known = new Set<string>();
  if (knownSmall && small) {
    const targets = small.nodes.map((n) => String(n.target.at(-1)));
    const hits = await page.evaluate(
      ([selectors, lines]) =>
        (selectors as string[]).filter((sel) =>
          document.querySelector(sel)?.matches(lines as string),
        ),
      [targets, knownSmall] as const,
    );
    for (const sel of hits) known.add(sel);
  }
  return results.violations
    .map((v) => ({
      ...v,
      nodes:
        v.id === 'target-size'
          ? v.nodes.filter((n) => !known.has(String(n.target.at(-1))))
          : v.nodes,
    }))
    .filter((v) => v.nodes.length > 0)
    .map(
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
          const known = !vp.phone && path === KNOWN_PATH;
          const found = await violations(page, known ? MONTH_LINES : undefined);
          // Soft: every page reports before the test fails.
          expect.soft(found, `${path}\n${found.join('\n')}`).toEqual([]);
          if (known) {
            const heights = await page
              .locator(MONTH_LINES)
              .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
            expect.soft(heights.length, 'month lines the exception is about').toBeGreaterThan(0);
            expect
              .soft(
                heights.some((h) => h < 24),
                'the month lines measure 24 px now: remove the exception (MONTH_LINES)',
              )
              .toBe(true);
          }
        }
      });
    }
  });
}
