import { expect, test } from '@playwright/test';

test('Rechtliches: imprint with open placeholders, every data flow, licence list', async ({
  page,
}) => {
  await page.goto('/settings/ueber');
  await expect(page.getByTestId('legal-open')).toBeVisible();
  await expect(page.getByText('[[NAME]]')).toBeVisible();
  await expect(page.getByTestId('flow-ai-cloud')).toBeAttached();
  await page.getByTestId('flow-update').getByText('Update-Abfrage bei GitHub').click();
  await expect(page.getByText(/Automatisch nach Updates suchen/).first()).toBeVisible();
  await page.getByText(/Bibliotheken der Windows- und Android-App/).click();
  await expect(page.getByText(/^tauri \d/).first()).toBeVisible();
});

test('the supporter notice shows once with the first action; only "Verstanden" closes it', async ({
  page,
}) => {
  await page.goto('/settings/ueber');
  await expect(page.getByTestId('legal-open')).toBeVisible();
  const dialog = page.getByTestId('notice-dialog');
  await expect(dialog).toBeHidden();
  await page.getByTestId('supporter-code-input').fill('kein-gueltiger-code');
  await page.getByTestId('supporter-code-save').click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await expect(dialog).toBeHidden();
  await page.getByTestId('supporter-code-save').click();
  await expect(dialog).toBeHidden();
});
