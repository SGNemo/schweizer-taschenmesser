import { expect, test } from '@playwright/test';
import { enable, ready } from './helpers';

// Own folders in "Unterlagen": a new one shows as a folder tab; deleting it moves its documents, never deletes them.
test.describe('Unterlagen: own categories', () => {
  test('add a folder, file a document in it, delete the folder: the document stays', async ({
    page,
  }) => {
    await enable(page, 'vault');
    await ready(page, '/vault?new=1');
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Titel').fill('Fahrzeugschein');
    await editor.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Kategorien bearbeiten' }).first().click();
    const admin = page.getByRole('dialog', { name: 'Kategorien' });
    await admin.getByRole('button', { name: /Neue Kategorie/ }).click();
    const form = page.getByRole('dialog', { name: 'Neue Kategorie' });
    await form.getByLabel('Name').fill('Fahrzeug');
    await form.getByRole('button', { name: 'Auto' }).click();
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByTestId('vault-categories')).toContainText('Fahrzeug');
    await page
      .getByRole('dialog', { name: 'Kategorien' })
      .getByRole('button', { name: 'Fertig' })
      .click();

    const tabs = page.getByTestId('vault-folders');
    await expect(tabs.getByRole('button', { name: /Fahrzeug 0/ })).toBeVisible();

    // File the document in the new folder.
    await page.locator('main [data-row]', { hasText: 'Fahrzeugschein' }).click();
    // On a wide page the row opens the detail panel beside the folders; its "Bearbeiten" opens the editor.
    const detail = page.getByTestId('document-detail');
    if (await detail.isVisible()) await detail.getByRole('button', { name: 'Bearbeiten' }).click();
    const edit = page.getByRole('dialog', { name: 'Unterlage bearbeiten' });
    await edit.getByLabel('Kategorie').selectOption({ label: 'Fahrzeug' });
    await edit.getByRole('button', { name: 'Speichern' }).click();
    await expect(tabs.getByRole('button', { name: /Fahrzeug 1/ })).toBeVisible();

    // Delete the folder: the dialog names the count, the document moves to "Ohne Kategorie".
    await page.getByRole('button', { name: 'Kategorien bearbeiten' }).first().click();
    await page.getByRole('button', { name: 'Fahrzeug löschen' }).click();
    await expect(page.getByTestId('vault-category-in-use')).toHaveText(
      '1 Unterlage ist in dieser Kategorie.',
    );
    await page.getByRole('button', { name: 'Löschen und verschieben' }).click();
    await expect(page.getByTestId('vault-categories')).not.toContainText('Fahrzeug');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('main [data-row]', { hasText: 'Fahrzeugschein' })).toContainText(
      'Ohne Kategorie',
    );
    await expect(tabs.getByRole('button', { name: /Fahrzeug/ })).toHaveCount(0);
  });
});
