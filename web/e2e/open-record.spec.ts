import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/** A search hit opens the record itself, not just the module list (docs/product/comfort, package 4). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Ctrl+K, type, pick the hit (the first option is the assistant). */
async function openHit(page: Page, text: string, hit: string) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill(text);
  await page.getByRole('option').filter({ hasText: hit }).click();
}

test('searching for a to-do opens its edit dialog: Ctrl+K, text, click the hit', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'pixel-7', 'the palette shortcut is a desktop feature');
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Garantie Waschmaschine');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Garantie Waschmaschine' }),
  ).toBeVisible();

  await ready(page, '/');
  await openHit(page, 'Waschmaschine', 'Garantie Waschmaschine');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Titel')).toHaveValue('Garantie Waschmaschine');
  // the parameter is consumed: a reload does not open it again
  await expect(page).not.toHaveURL(/open=/);
});

test('a deep link to a booking opens its dialog', async ({ page }, info) => {
  test.skip(info.project.name === 'pixel-7', 'the palette shortcut is a desktop feature');
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill('33,00');
  await dialog.getByLabel('Empfänger / Titel').fill('Tierarzt Muster');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await ready(page, '/');
  await openHit(page, 'Tierarzt', 'Tierarzt Muster');
  await expect(page.getByRole('dialog', { name: 'Buchung bearbeiten' })).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Betrag')).toHaveValue('33,00');
});

test('a person from the search opens its detail page', async ({ page }, info) => {
  test.skip(info.project.name === 'pixel-7', 'the palette shortcut is a desktop feature');
  await enable(page, 'people');
  await ready(page, '/people?new=1');
  const dialog = page.getByRole('dialog', { name: 'Person hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill('Frieda Beispiel');
  await dialog.getByLabel('Geburtsdatum').fill('1950-05-05');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await ready(page, '/');
  await openHit(page, 'Frieda', 'Frieda Beispiel');
  await expect(page.getByRole('heading', { name: 'Frieda Beispiel' })).toBeVisible();
});

test('an unknown id lands on the module page without an error', async ({ page }) => {
  await ready(page, '/todos?open=does-not-exist');
  await expect(page.getByRole('heading', { name: 'ToDos' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/open=/);
});
