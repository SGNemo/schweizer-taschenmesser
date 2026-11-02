import { expect, test, type Page } from '@playwright/test';
import { dismissNotices, ready } from './helpers';

test.beforeEach(({ page }) => dismissNotices(page));

const SHORTCUTS = '/settings/allgemein#shortcuts';

/** Records `key` on the button of one action (click, then press). */
async function record(page: Page, testId: string, key: string) {
  const button = page.getByTestId(testId);
  await button.click();
  await expect(button).toHaveAttribute('data-hotkey-recording', 'true');
  await page.keyboard.press(key);
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'keys are a desktop feature');

  test('T then T opens the timer, T then R the calculator', async ({ page }) => {
    await ready(page, '/');
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    await expect(page.getByRole('dialog', { name: 'Timer & Stoppuhr' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('t');
    await page.keyboard.press('r');
    await expect(page.getByRole('dialog', { name: 'Rechner' })).toBeVisible();
  });

  test('a tool that is off has no chord', async ({ page }) => {
    await ready(page, '/');
    await page.keyboard.press('t');
    await page.keyboard.press('w'); // Würfel & Zufall is off by default
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the T chord is not taken while typing', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    const name = page.getByRole('textbox').first();
    await name.focus();
    await page.keyboard.type('tt');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('an F-key works inside a text field and types nothing', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    const field = page.getByRole('textbox').first();
    await field.focus();
    await page.keyboard.press('F6'); // Heute
    await expect(page).toHaveURL(/\/$/);
    await ready(page, '/settings/allgemein');
    await page.getByRole('textbox').first().focus();
    await page.keyboard.press('F10'); // Cockpit
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('cockpit-grid')).toBeVisible();
    await page.keyboard.press('F10'); // and back
    await expect(page.getByTestId('cockpit-grid')).toHaveCount(0);
    await ready(page, '/settings/allgemein');
    await page.getByRole('textbox').first().focus();
    await page.keyboard.press('F2'); // Neu erfassen
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('F3 opens the palette, which shows the key behind an action', async ({ page }) => {
    await ready(page, '/');
    await page.keyboard.press('F3');
    const palette = page.getByRole('dialog', { name: 'Suchen' });
    await expect(palette).toBeVisible();
    await page.getByRole('combobox').fill('Timer');
    const option = palette.getByRole('option', { name: /Werkzeug: Timer/ }).first();
    await expect(option).toContainText('F8');
    await expect(option).toContainText('T T');
  });

  test('rebind a key in the settings; afterwards it works and the sheet lists it', async ({
    page,
  }) => {
    await ready(page, SHORTCUTS);
    // F9 belongs to the calculator: refused with a text, nothing moves.
    await record(page, 'shortcut-today', 'F9');
    await expect(page.getByTestId('shortcut-message')).toContainText('gehört schon');
    await expect(page.getByTestId('shortcut-today')).toContainText('F6');
    // A key of the browser is refused too.
    await record(page, 'shortcut-today', 'F5');
    await expect(page.getByTestId('shortcut-message')).toContainText('Browser');
    // Free the key, then take it.
    await page.getByRole('button', { name: /^Entfernen: .*Rechner/ }).click();
    await record(page, 'shortcut-today', 'F9');
    await expect(page.getByTestId('shortcut-today')).toContainText('F9');

    await ready(page, '/settings');
    await page.keyboard.press('F6');
    await expect(page).toHaveURL(/\/settings/); // the old key is free now
    await page.keyboard.press('F9');
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Tastenkürzel' });
    await expect(sheet).toContainText('Funktionstasten');
    await expect(sheet).toContainText('Zur Übersicht (Heute)');
    await expect(sheet.locator('kbd', { hasText: /^F9$/ })).toBeVisible();
    await expect(sheet).toContainText('dann R'); // chords of the tools that are on
  });

  test('a key recorder keeps the key to itself while it records', async ({ page }) => {
    await ready(page, SHORTCUTS);
    await page.getByTestId('shortcut-today').click();
    await page.keyboard.press('F10'); // would toggle the cockpit; the recorder takes it
    await expect(page.getByTestId('shortcut-message')).toContainText('gehört schon');
  });
});

test('the section works without keys: remove and restore a key by tapping', async ({ page }) => {
  await ready(page, SHORTCUTS);
  const timer = page.getByTestId('shortcut-tool-timer');
  await expect(timer).toContainText('F8');
  await page.getByRole('button', { name: /^Entfernen: .*Timer/ }).click();
  await expect(timer).toContainText('Keine Taste');
  await page.getByRole('button', { name: /^Standard: .*Timer/ }).click();
  await expect(timer).toContainText('F8');
  await expect(page.getByTestId('shortcut-voice')).toContainText('F4');
  await expect(page.getByTestId('shortcut-chords')).toContainText('Rechner');
});
