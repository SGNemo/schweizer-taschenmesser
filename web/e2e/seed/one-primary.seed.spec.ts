import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, moduleRoutes, openPage, PHONE, startSeeded } from './guards';

/**
 * One filled main action per page and per dialog (DESIGN-SPEC: one filled accent per screen; UI audit 2026-11, package
 * 0a-1b). Counted are visible buttons of the `primary` variant inside `main` and inside an open dialog; the top bar's
 * "+ Neu" sits outside `main` and is decided with package 0b-2.
 */
const visiblePrimaries = (scope: Locator) =>
  scope.locator('[class*="_primary_"]').evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
      })
      .map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()),
  );

async function check(page: Page, phone: boolean) {
  await startSeeded(page, { phone });
  for (const path of ['/', '/library', '/settings', ...moduleRoutes(phone)]) {
    await openPage(page, path);
    const found = await visiblePrimaries(page.locator('main'));
    expect.soft(found.length, `${path}: ${found.join(' | ')}`).toBeLessThanOrEqual(1);
  }
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

  test('at most one primary button in main on every page', async ({ page }) => {
    test.setTimeout(240_000);
    await check(page, false);
  });

  test('the count sees primary buttons: pages known to have one report exactly one', async ({
    page,
  }) => {
    // Without this a renamed class would make every page pass with zero.
    await startSeeded(page);
    for (const path of ['/vault', '/invoices', '/pantry']) {
      await openPage(page, path);
      expect(await visiblePrimaries(page.locator('main')), path).toHaveLength(1);
    }
  });

  test('at most one primary button in the dialogs of the shell', async ({ page }) => {
    await startSeeded(page);
    await openPage(page, '/todos');
    for (const open of [
      () => page.keyboard.press('Control+k'),
      () => page.getByRole('button', { name: /^Erinnerungen/ }).click(),
    ]) {
      await open();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const found = await visiblePrimaries(dialog);
      expect(found.length, found.join(' | ')).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });
});

test.describe('phone', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'small', preview: true },
  });
  test('at most one primary button in main on every page', async ({ page }) => {
    test.setTimeout(240_000);
    await check(page, true);
  });
});
