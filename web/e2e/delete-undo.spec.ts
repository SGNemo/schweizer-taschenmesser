import { expect, test } from '@playwright/test';
import { enable, ready } from './helpers';

test.describe('Unterlagen: delete with undo, draft kept (B09)', () => {
  test('delete asks nothing, offers "Rückgängig" and the file comes back with the record', async ({
    page,
  }) => {
    await enable(page, 'vault');
    await ready(page, '/vault?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Mietvertrag');
    await dialog.getByLabel('Datei').setInputFiles({
      name: 'miete.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Vertrag'),
    });
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const item = page.getByRole('listitem').filter({ hasText: 'Mietvertrag' });
    const row = item.getByRole('button', { name: /^Mietvertrag/ });
    await expect(item).toContainText('miete.txt');

    await row.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    // no confirmation dialog: the record is gone and the toast offers the way back
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(item).toHaveCount(0);
    await page.getByRole('button', { name: 'Rückgängig' }).click();

    await expect(item).toBeVisible();
    await expect(item).toContainText('miete.txt');
    await expect(item).not.toContainText('nur auf einem anderen Gerät');
    await expect(item.getByRole('button', { name: /Herunterladen/ })).toBeVisible();
  });

  test('Esc and a tap beside the dialog keep the typed text; "Abbrechen" drops it', async ({
    page,
  }) => {
    await enable(page, 'vault');
    await ready(page, '/vault?new=1');
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Versicherung');
    await dialog.getByLabel('Notiz').fill('Police Nr. 4711, Anruf am Montag');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Unterlage hinzufügen' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('draft-restored')).toBeVisible();
    await expect(dialog.getByLabel('Titel')).toHaveValue('Versicherung');
    await expect(dialog.getByLabel('Notiz')).toHaveValue('Police Nr. 4711, Anruf am Montag');

    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByRole('button', { name: 'Unterlage hinzufügen' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Titel')).toHaveValue('');
    await expect(dialog.getByTestId('draft-restored')).toHaveCount(0);
  });
});
