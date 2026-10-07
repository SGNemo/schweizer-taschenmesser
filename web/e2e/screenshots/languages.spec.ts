import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * The overview in every UI language, with the shared invented test data of the Dev-Preview build
 * (entries stay German: they are data, not UI). Output: SCREENS_DIR (default docs/i18n/screenshots).
 * Not part of CI; run with `npm run screenshots -- languages.spec.ts`.
 */
const OUT = process.env.SCREENS_DIR ?? '../docs/i18n/screenshots';
const LANGS = { de: 'Schließen', en: 'Close', es: 'Cerrar', fr: 'Fermer', 'pt-BR': 'Fechar' };

test('overview in every language', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await bootDev(page);
  await seedApp(page, 'small');
  for (const [lang, close] of Object.entries(LANGS)) {
    await page.evaluate((l) => localStorage.setItem('tm-lang', l), lang);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('main h1')).toBeVisible();
    // The one-time Dev-Preview notice appears after every full load: close it for the shot.
    const notice = page.getByRole('button', { name: close, exact: true });
    if (await notice.count()) await notice.first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/overview-${lang}.png` });
  }
  await context.close();
});
