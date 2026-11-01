import { expect, test, type Page } from '@playwright/test';
import { moduleSwitch } from './helpers';

/**
 * Offline after the first load (docs/perf/COLD-START-2026-10.md): the service worker precaches the app
 * except tools, chat and the password dictionaries, which load on first use and stay in its runtime cache.
 * This spec needs the real service worker (the suite blocks it elsewhere for deterministic tests).
 */
test.use({ serviceWorkers: 'allow' });

/** First visit online: the service worker installs, precaches and then controls the page. */
async function install(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(
      () =>
        page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
      {
        timeout: 60_000,
      },
    )
    .toBe('activated');
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

const calc = (page: Page) => page.getByRole('dialog', { name: 'Rechner' });

test('after the first load: overview and a tool opened before work offline; a tool never opened says it loads once online', async ({
  page,
  context,
}) => {
  await install(page);
  await page.goto('/tools/calc');
  await expect(calc(page).getByLabel('Modus')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();

  // Opened before: served by the runtime cache.
  await page.goto('/tools/calc');
  await expect(calc(page).getByLabel('Modus')).toBeVisible();
  await page.keyboard.press('Escape');

  // Never opened: one calm line instead of an error screen; back online it loads by itself.
  await page.goto('/tools/qr');
  const qr = page.getByRole('dialog', { name: 'QR-Code' });
  const note = qr.getByTestId('online-chunk');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('role', 'status');
  await expect(note).toContainText('lädt beim ersten Öffnen aus dem Netz');
  await expect(page.getByRole('alert')).toHaveCount(0);

  // Back online: Chromium remembers the failed import for this page, so "Erneut versuchen" reloads it;
  // then the tool loads (and is kept for offline use from now on).
  await context.setOffline(false);
  await qr.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('main h1')).toBeVisible();
  await page.goto('/tools/qr');
  await expect(qr.getByTestId('online-chunk')).toHaveCount(0);
  await expect(qr.getByRole('textbox').first()).toBeVisible();
});

test('vault offline before the strength dictionaries ever loaded: a calm note instead of an error', async ({
  page,
  context,
}) => {
  await install(page);
  await page.goto('/library');
  const card = page.getByTestId('module-accounts');
  await moduleSwitch(card).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/accounts');
  await page.getByLabel('Master-Passwort', { exact: true }).fill('Ein-ziemlich-langes-Passwort');
  const note = page.getByTestId('online-chunk');
  await expect(note).toContainText('Stärke-Anzeige lädt beim ersten Mal aus dem Netz');
  await expect(page.getByRole('alert')).toHaveCount(0);

  await expect(note.getByRole('button')).toHaveCount(0);

  // Back online: the meter tries again; the page remembers the failed import, so it offers a reload.
  await context.setOffline(false);
  await note.getByRole('button', { name: 'Erneut versuchen' }).click();
  await page.getByLabel('Master-Passwort', { exact: true }).fill('Ein-ziemlich-langes-Passwort');
  await expect(page.getByTestId('strength')).toBeVisible({ timeout: 20_000 });
  await expect(note).toHaveCount(0);
});
