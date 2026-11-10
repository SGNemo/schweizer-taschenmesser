import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { test } from './helpers';
import { openPage, PHONE, startSeeded } from './guards';

/**
 * The phone parts of the identity specs (UI audit 2026-11, package 0a-1b). `e2e/library-identity.spec.ts` and
 * `e2e/a11y.spec.ts` check them only in the `pixel-7` project, which runs on full runs; the seed project runs on every
 * web pull request, so the same asserts live here at 412 × 915.
 */
test.use({
  viewport: PHONE,
  isMobile: true,
  hasTouch: true,
  seeded: { scale: 'small', preview: true },
});

test('library: the drawn sketch of a card is hidden on the phone', async ({ page }) => {
  await startSeeded(page, { phone: true });
  await openPage(page, '/library');
  const card = page.getByTestId('module-todos');
  await expect(card).toHaveAttribute('data-hue', /.+/);
  await expect(card.getByTestId('widget-miniature')).toBeAttached();
  await expect(card.getByTestId('widget-miniature')).toBeHidden();
});

test('library: the first card shows its switch above the bottom navigation', async ({ page }) => {
  await startSeeded(page, { phone: true });
  await openPage(page, '/library');
  const card = page.locator('[data-testid^="module-"]').first();
  const box = await card.getByRole('switch').boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
  expect(box, 'switch').not.toBeNull();
  expect(nav, 'bottom navigation').not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(nav?.y ?? 0);
});

test('library, its detail page and the tools fit the phone', async ({ page }) => {
  await startSeeded(page, { phone: true });
  for (const path of ['/library', '/library/todos', '/tools']) {
    await openPage(page, path);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over, path).toBeLessThanOrEqual(0);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the "Mehr" sheet of the bottom navigation passes axe (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await startSeeded(page, { phone: true });
    await openPage(page, '/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('button', { name: 'Mehr' }).click();
    await expect(page.getByRole('dialog', { name: 'Mehr' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
