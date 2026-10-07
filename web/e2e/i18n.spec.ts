import { expect, test, type Page } from '@playwright/test';

/**
 * UI language: the switch in Settings → Allgemein takes effect at once and survives a reload, the
 * setup assistant asks for it in its first step, and a new installation follows the system language
 * (Playwright's `locale` stands in for the browser and the Android WebView, both report it as
 * `navigator.languages`).
 */

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

const languageSelect = (page: Page, label: string) =>
  page.getByRole('main').getByRole('combobox', { name: label, exact: true });

test('switching to English changes the UI at once and stays after a reload', async ({ page }) => {
  await ready(page, '/settings/allgemein');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await languageSelect(page, 'Sprache').selectOption('en');

  // No reload: the same page now speaks English.
  await expect(languageSelect(page, 'Language')).toHaveValue('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Name and region' })).toBeVisible();

  await page.reload();
  await expect(languageSelect(page, 'Language')).toHaveValue('en');

  // "Like the device" goes back to the system language (German in this project).
  await languageSelect(page, 'Language').selectOption('system');
  await expect(languageSelect(page, 'Sprache')).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('the setup assistant asks for the language in its first step', async ({ page }) => {
  await ready(page, '/');
  await page
    .getByTestId('setup-welcome')
    .getByRole('button', { name: 'Einrichtung starten' })
    .click();
  const wizard = page.getByRole('dialog', { name: 'Einrichtung' });
  await expect(wizard.getByText(/^Schritt 1 von \d+$/)).toBeVisible();
  await wizard.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('es');

  // The assistant stays open on the same step, now in Spanish.
  const asistente = page.getByRole('dialog', { name: 'Configuración inicial' });
  await expect(asistente.getByText(/^Paso 1 de \d+$/)).toBeVisible();
  await expect(asistente.getByRole('combobox', { name: 'Idioma', exact: true })).toHaveValue('es');
});

test.describe('system language', () => {
  test.use({ locale: 'es-ES' });

  test('a new installation starts in the system language', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    const select = languageSelect(page, 'Idioma');
    await expect(select).toHaveValue('system');
    await expect(select.locator('option[value="system"]')).toHaveText(/español/i);
  });
});

test.describe('unsupported system language', () => {
  test.use({ locale: 'ja-JP' });

  test('falls back to English', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(languageSelect(page, 'Language')).toHaveValue('system');
  });
});
