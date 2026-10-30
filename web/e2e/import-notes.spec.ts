import { expect, test } from '@playwright/test';
import { enable } from './helpers';

const keep = JSON.stringify([
  {
    title: 'Einkauf',
    textContent: '',
    listContent: [
      { text: 'Milch', isChecked: false },
      { text: 'Brot', isChecked: true },
    ],
    labels: [{ name: 'Haushalt' }],
    isTrashed: false,
    isArchived: false,
  },
  { title: 'Alt', textContent: 'Archiviert', isArchived: true },
]);

test('Notizen: Markdown-Dateien und Keep-Export → Vorschau → Import → Wiederholung ist Dublette', async ({
  page,
}) => {
  await enable(page, 'notes');
  // Enabling offers the start-data wizard once.
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog.getByRole('button', { name: /Markdown-Dateien oder Google Keep/ }).click();

  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser
  ).setFiles([
    {
      name: 'Gartenplan.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '---\ntags: [garten]\n---\n# Gartenplan Frühling\n\nBeete umgraben, [[Saatgut]] bestellen',
      ),
    },
    { name: 'leer.md', mimeType: 'text/markdown', buffer: Buffer.from('') },
    { name: 'Einkauf.json', mimeType: 'application/json', buffer: Buffer.from(keep) },
  ]);

  await expect(dialog.getByText('2 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText('1 leere Datei wurde übersprungen.')).toBeVisible();
  await expect(dialog.getByText(/1 Keep-Notiz aus Papierkorb oder Archiv/)).toBeVisible();
  await dialog.getByRole('checkbox', { name: /Einkauf/ }).click();
  await dialog.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page.goto('/notes');
  await expect(page.getByText('Gartenplan Frühling')).toBeVisible();
  await expect(page.getByText('Einkauf')).toHaveCount(0);

  // Choosing the same files again: the stored note is recognised, the unticked one is new.
  await page.goto('/library');
  await page.getByTestId('module-notes').getByRole('button', { name: 'Importieren' }).click();
  const again = page.getByRole('dialog', { name: /Importieren/ });
  await again.getByRole('button', { name: /Markdown-Dateien oder Google Keep/ }).click();
  const chooser2 = page.waitForEvent('filechooser');
  await again.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser2
  ).setFiles([
    {
      name: 'Gartenplan.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '---\ntags: [garten]\n---\n# Gartenplan Frühling\n\nBeete umgraben, [[Saatgut]] bestellen',
      ),
    },
  ]);
  await expect(again.getByText('Schon vorhanden')).toBeVisible();
});

test('Notizen: eingefügtes Markdown wird eine Notiz', async ({ page }) => {
  await enable(page, 'notes');
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog.getByRole('button', { name: /Markdown einfügen/ }).click();
  await dialog
    .getByLabel('Markdown-Text')
    .fill('# Wochenplan\n\nEinkaufen #haushalt\nMama anrufen');
  await dialog.getByRole('button', { name: 'Vorschau anzeigen' }).click();
  await expect(dialog.getByText('1 Eintrag erkannt')).toBeVisible();
  await dialog.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();
  await page.goto('/notes');
  await expect(page.getByText('Wochenplan')).toBeVisible();
});
