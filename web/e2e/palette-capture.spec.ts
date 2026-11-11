import { expect, test } from '@playwright/test';

// UI audit 2026-11, click path "Enter in the search field lands at the assistant": Enter on free text enters it
// (quick capture, on the device), "?" asks.
test('free text + Enter in the search bar is quick capture; a second Enter saves it', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('header').first().getByRole('button', { name: /suche/i }).click();
  const bar = page.getByRole('combobox');
  await bar.fill('Irgendwas mit Opa klären');
  await expect(page.getByRole('option').first()).toContainText(
    'Schnell hinzufügen: „Irgendwas mit Opa klären“',
  );
  await bar.press('Enter');
  await expect(page.getByTestId('ai-answer')).toHaveCount(0);
  const box = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });
  await expect(box).toHaveValue('Irgendwas mit Opa klären');
  // Enter only means something once the module states are loaded: the target chip shows that.
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: ToDos');
  await box.press('Enter');
  await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
});

test('"?" asks instead', async ({ page }) => {
  await page.goto('/');
  await page.locator('header').first().getByRole('button', { name: /suche/i }).click();
  const bar = page.getByRole('combobox');
  await bar.fill('?Irgendwas mit Opa klären');
  await expect(page.getByRole('option').first()).toContainText('„Irgendwas mit Opa klären“');
  await expect(page.getByRole('option', { name: /^Schnell hinzufügen/ })).toHaveCount(0);
  await bar.press('Enter');
  await expect(page.getByTestId('ai-answer')).toBeVisible();
});
