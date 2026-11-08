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

test('the setup assistant asks for the language in its first question', async ({ page }) => {
  await ready(page, '/');
  await page
    .getByTestId('setup-welcome')
    .getByRole('button', { name: 'Einrichtung starten' })
    .click();
  const wizard = page.getByRole('dialog', { name: 'Einrichtung' });
  await expect(wizard.getByText('Frage 1 von 4')).toBeVisible();
  const select = wizard.getByRole('combobox', { name: 'Sprache', exact: true });
  // German and English only (es, fr, pt-BR are frozen), plus "like the device".
  await expect(select.locator('option')).toHaveCount(3);
  await select.selectOption('en');

  // The assistant stays open on the same step, now in English.
  const setup = page.getByRole('dialog', { name: 'Setup' });
  await expect(setup.getByText('Question 1 of 4')).toBeVisible();
  await expect(setup.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
});

test('the language picker offers German and English only', async ({ page }) => {
  await ready(page, '/settings/allgemein');
  const options = languageSelect(page, 'Sprache').locator('option');
  await expect(options).toHaveCount(3);
  await expect(options.nth(1)).toHaveText('Deutsch');
  await expect(options.nth(2)).toHaveText('English');
});

test.describe('frozen language stored', () => {
  test('a device that had French picked starts in English, quietly', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('tm-lang', 'fr');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await ready(page, '/settings/allgemein');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(languageSelect(page, 'Language')).toHaveValue('en');
    // No dialog about it.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('tm-lang'))).toBe('en');
    // Formats that followed French stay French (decimal comma, day first).
    expect(await page.evaluate(() => localStorage.getItem('tm-format'))).toBe('fr-FR');
  });
});

test.describe('system language', () => {
  test.use({ locale: 'de-AT' });

  test('a new installation starts in the system language', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    const select = languageSelect(page, 'Sprache');
    await expect(select).toHaveValue('system');
    await expect(select.locator('option[value="system"]')).toHaveText(/deutsch/i);
  });
});

test.describe('frozen system language', () => {
  test.use({ locale: 'es-ES' });

  test('falls back to English', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const select = languageSelect(page, 'Language');
    await expect(select).toHaveValue('system');
    await expect(select.locator('option[value="system"]')).toHaveText(/english/i);
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
