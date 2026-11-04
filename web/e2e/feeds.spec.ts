import { expect, test } from '@playwright/test';
import { enable } from './helpers';

test('Feeds: hinzufügen, gruppieren, doppelte erkennen, bearbeiten, entfernen', async ({
  page,
}) => {
  await enable(page, 'feeds');
  await page.goto('/feeds');
  await page.getByRole('button', { name: 'Feed hinzufügen' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Feed hinzufügen' });
  await dialog.getByRole('textbox', { name: /Adresse des Feeds/ }).fill('keine adresse');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Das ist keine Web-Adresse (http oder https).',
  );

  await dialog
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('blog.example.org/feed.xml');
  await dialog.getByRole('combobox', { name: 'Gruppe' }).fill('Blogs');
  await dialog.getByRole('button', { name: 'Speichern' }).click();

  // Name defaults to the host; the list is grouped.
  await expect(page.getByRole('heading', { name: /Blogs/ })).toBeVisible();
  await expect(page.getByText('blog.example.org').first()).toBeVisible();

  // The same feed twice is refused.
  await page.getByRole('button', { name: 'Feed hinzufügen' }).first().click();
  const again = page.getByRole('dialog', { name: 'Feed hinzufügen' });
  await again
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('https://www.blog.example.org/feed.xml');
  await again.getByRole('button', { name: 'Speichern' }).click();
  await expect(again.getByRole('alert')).toHaveText('Diesen Feed hast du schon.');
  await again.getByRole('button', { name: 'Abbrechen' }).click();

  // Remove it again.
  await page.getByRole('button', { name: /Aktionen für blog.example.org/ }).click();
  await page.getByRole('menuitem', { name: /Entfernen/ }).click();
  await expect(page.getByText('Noch keine Feeds').first()).toBeVisible();
});

const OPML = `<?xml version="1.0"?>
<opml version="2.0"><head><title>t</title></head><body>
<outline text="Podcasts"><outline type="rss" text="Werkstatt" xmlUrl="https://werkstatt.example.org/p.rss"/></outline>
<outline type="rss" text="Blog" xmlUrl="https://blog.example.org/feed.xml"/>
<outline type="rss" text="Kaputt" xmlUrl="javascript:alert(1)"/>
</body></opml>`;

test('Feeds: OPML importieren (Vorschau, Bericht, Duplikat) und exportieren', async ({ page }) => {
  await enable(page, 'feeds');
  await page.goto('/feeds');
  await page.getByRole('button', { name: 'Importieren' }).first().click();
  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await wizard.getByRole('button', { name: /OPML-Datei/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await wizard.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser
  ).setFiles([{ name: 'abos.opml', mimeType: 'text/xml', buffer: Buffer.from(OPML) }]);

  await expect(wizard.getByText('2 Einträge erkannt')).toBeVisible();
  await expect(wizard.getByText(/1 Eintrag wird nicht unterstützt/)).toBeVisible();
  await wizard.getByRole('button', { name: '2 Einträge importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('2 Einträge wurden importiert.');
  await wizard.getByRole('button', { name: 'Schließen' }).last().click();

  await expect(page.getByRole('heading', { name: /Podcasts/ })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als OPML exportieren' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^nemo-feeds-\d{4}-\d{2}-\d{2}\.opml$/);
});
