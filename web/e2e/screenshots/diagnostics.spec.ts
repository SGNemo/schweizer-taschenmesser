import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Screenshots for the bug-report PRs (diagnostics preview, recovery screen, safe mode). Not part of
 * CI (see playwright.screens.config.ts). Output: docs/screenshots/diagnostics.
 */
const OUT = resolve(process.cwd(), '../docs/screenshots/diagnostics');
mkdirSync(OUT, { recursive: true });
test.use({ viewport: { width: 1100, height: 760 }, colorScheme: 'light' });

test('diagnostics preview, language setting, safe mode banner', async ({ page }) => {
  await page.goto('/settings/ueber');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'Diagnose exportieren' }).click();
  await expect(page.getByTestId('diagnostics-preview')).toContainText('## Migrations');
  await page.screenshot({ path: `${OUT}/diagnostics-preview.png` });
  await page.getByRole('button', { name: 'Schließen' }).first().click();
  await page.getByRole('heading', { name: 'Sprache' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/about-language-and-report.png` });

  await page.goto('/?safe=1');
  await expect(page.getByTestId('safe-mode-banner')).toBeVisible();
  await page.screenshot({ path: `${OUT}/safe-mode.png` });
});

test('recovery screen when the database cannot be opened', async ({ page }) => {
  // Make every open of the app database fail the way a database from an incompatible version does.
  await page.addInitScript(() => {
    const real = indexedDB.open.bind(indexedDB);
    indexedDB.open = ((name: string, version?: number) => {
      if (name !== 'taschenmesser') return real(name, version);
      const req = new EventTarget() as unknown as IDBOpenDBRequest;
      Object.defineProperty(req, 'error', {
        value: new DOMException(
          'The requested version is lower than the stored one',
          'VersionError',
        ),
      });
      setTimeout(() => {
        const ev = new Event('error', { cancelable: true });
        req.dispatchEvent(ev);
        (req as { onerror?: (e: Event) => void }).onerror?.(ev);
      }, 0);
      return req;
    }) as typeof indexedDB.open;
  });
  await page.goto('/');
  await expect(page.getByTestId('recovery-detail')).toContainText('VersionError');
  await page.screenshot({ path: `${OUT}/recovery.png`, fullPage: true });
});
