import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test.describe('Drafts in Termin- and Abo-Dialog', () => {
  test('an appointment keeps its text after Esc; Abbrechen drops it', async ({ page }) => {
    await ready(page, '/calendar?new=1');
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Zahnarzt');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // reopened inside the app (the draft lives in memory, a page reload drops it)
    await page.getByRole('button', { name: 'Neuer Termin' }).first().click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('draft-restored')).toBeVisible();
    await expect(dialog.getByLabel('Titel')).toHaveValue('Zahnarzt');

    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByRole('button', { name: 'Neuer Termin' }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Titel')).toHaveValue('');
  });

  test('a subscription keeps name and amount after Esc', async ({ page }) => {
    await ready(page, '/subscriptions?new=1');
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Streaming');
    await dialog.getByLabel('Betrag').fill('12,99');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Abo hinzufügen' }).first().click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('draft-restored')).toBeVisible();
    await expect(dialog.getByLabel('Name')).toHaveValue('Streaming');
    await expect(dialog.getByLabel('Betrag')).toHaveValue('12,99');
  });
});
