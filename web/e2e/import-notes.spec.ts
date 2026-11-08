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
  await dialog
    .getByRole('button', { name: /Markdown, Obsidian, Evernote oder Google Keep/ })
    .click();

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
  await expect(dialog.getByText('1 leerer Eintrag wurde übersprungen.')).toBeVisible();
  await expect(dialog.getByText(/1 Eintrag aus Papierkorb oder Archiv/)).toBeVisible();
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
  await again
    .getByRole('button', { name: /Markdown, Obsidian, Evernote oder Google Keep/ })
    .click();
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

test('Notizen: ein Obsidian-Export (ZIP) behält Ordner, Reihenfolge und Unterordner (D03–D06)', async ({
  page,
}) => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, relative, resolve } = await import('node:path');
  const { zipSync } = await import('fflate');
  const root = resolve(process.cwd(), 'e2e/fixtures/obsidian-d');
  const entries: Record<string, Uint8Array> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else entries[relative(root, path).replaceAll('\\', '/')] = readFileSync(path);
    }
  };
  walk(root);

  await enable(page, 'notes');
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog
    .getByRole('button', { name: /Markdown, Obsidian, Evernote oder Google Keep/ })
    .click();
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser
  ).setFiles([
    { name: 'Vault.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(entries)) },
  ]);

  await expect(dialog.getByText('10 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText(/nicht lesbar/)).toHaveCount(0);
  const books = dialog.getByText('Neues Notizbuch').locator('..');
  await expect(books).toHaveText([/10_Arbeit/, /20_Privat/, /90_Archiv/]);
  await dialog.getByRole('button', { name: '10 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText(/importiert/);
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page.goto('/notes');
  await expect(page.getByRole('button', { name: /10_Arbeit · 3/ })).toBeVisible();
  await expect(page.getByText('#Projekte').first()).toBeVisible();
});
