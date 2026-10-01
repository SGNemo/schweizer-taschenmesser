import { expect, type Page } from '@playwright/test';

/** Reference date of all seeded E2E data (`page.clock.setFixedTime`). Seed version in the status. */
export const SEED_TODAY = '2026-09-29';

/**
 * Prepares a page of the dev-flavoured app (`playwright.config.ts` project `seed-dev`): fixed
 * clock, and the first-start auto-fill switched off unless a test is about it.
 */
export async function bootDev(page: Page, opts: { autofill?: boolean } = {}) {
  await page.clock.setFixedTime(new Date(`${SEED_TODAY}T10:00:00`));
  if (!opts.autofill)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tm-seed-autofilled', '1');
      } catch {
        // storage blocked – then auto-fill would not run either
      }
    });
}

/** Settings → Entwickler → "Testdaten laden" for `scale` and waits until the status shows it. */
export async function seedApp(page: Page, scale: 'small' | 'medium' | 'large' = 'small') {
  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption(scale);
  await section.getByTestId('seed-load').click();
  await expect(section.getByTestId('seed-status')).toContainText(SEED_TODAY, { timeout: 60_000 });
}
