import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Screenshots of the setup assistant (manual tooling, see playwright.screens.config.ts).
 * Invented data only. Output: SCREENS_DIR (default test-results/screens/setup).
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/setup';
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Einrichtung' });

for (const vp of VIEWPORTS) {
  test(`setup assistant ${vp.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}-${vp.name}.png` });

    await page.goto('/');
    await expect(page.getByTestId('setup-welcome')).toBeVisible();
    await shot('1-welcome');

    await page
      .getByTestId('setup-welcome')
      .getByRole('button', { name: 'Einrichtung starten' })
      .click();
    await expect(wizard(page)).toBeVisible();
    await wizard(page).getByLabel('Dein Name (optional)').fill('Erika Erfunden');
    await shot('2-basics');
    await wizard(page).getByRole('button', { name: 'Weiter' }).click();
    await wizard(page).getByRole('button', { name: 'Überspringen' }).click(); // sync
    await expect(wizard(page).getByRole('heading', { name: 'Profil und Module' })).toBeVisible();
    await wizard(page).getByTestId('profile-minimal').click();
    await shot('3-profiles-diff');
    await wizard(page).getByRole('button', { name: 'Überspringen' }).click();
    await wizard(page).getByRole('button', { name: 'Überspringen' }).click(); // tools
    await expect(wizard(page).getByRole('heading', { name: 'KI-Anbieter' })).toBeVisible();
    await shot('4-ai');

    await page.keyboard.press('Escape');
    await expect(wizard(page).getByTestId('setup-confirm')).toBeVisible();
    await shot('5-cancel-dialog');
    await wizard(page).getByRole('button', { name: 'Einrichtung beenden' }).click();
    await expect(page.getByTestId('setup-checklist')).toBeVisible();
    await shot('6-dashboard-checklist');

    await page.goto('/settings/ueber');
    await expect(page.getByRole('heading', { name: 'Einrichtung', level: 2 })).toBeVisible();
    await shot('7-settings');
    await context.close();
  });
}
