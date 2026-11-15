import { expect, test } from '@playwright/test';
import { enable } from './helpers';

test('Feeds: hinzufügen, gruppieren, doppelte erkennen, bearbeiten, entfernen', async ({
  page,
}) => {
  await enable(page, 'feeds');
  await page.goto('/feeds');
  await page
    .getByRole('button', { name: /Feed (hinzufügen|eintragen)/ })
    .first()
    .click();

  // The add dialog takes a search word or an address; an address goes on to the form.
  const finder = page.getByRole('dialog', { name: 'Feed eintragen' });
  await finder
    .getByRole('searchbox', { name: 'Suchen oder Adresse einfügen' })
    .fill('blog.example.org/feed.xml');
  // "Ansehen" goes online only on this click; without the app or a sync server it says so calmly.
  await finder.getByRole('button', { name: 'Ansehen' }).click();
  await expect(
    finder.getByText(/Die Vorschau geht in der App oder mit eigenem Sync-Server/),
  ).toBeVisible();
  await finder.getByRole('button', { name: 'Trotzdem eintragen' }).click();

  const dialog = page.getByRole('dialog', { name: 'Feed eintragen' });
  await dialog.getByRole('textbox', { name: /Adresse des Feeds/ }).fill('keine adresse');
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Das ist keine Web-Adresse (http oder https).',
  );

  await dialog
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('blog.example.org/feed.xml');
  await dialog.getByRole('combobox', { name: 'Gruppe' }).fill('Blogs');
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();

  // Name defaults to the host; the list is grouped.
  await expect(page.getByRole('heading', { name: /Blogs/ })).toBeVisible();
  await expect(page.getByText('blog.example.org').first()).toBeVisible();

  // The same feed twice is refused.
  await page
    .getByRole('button', { name: /Feed (hinzufügen|eintragen)/ })
    .first()
    .click();
  await page
    .getByRole('searchbox', { name: 'Suchen oder Adresse einfügen' })
    .fill('blog.example.org');
  await page.getByRole('button', { name: 'Ohne Vorschau eintragen' }).click();
  const again = page.getByRole('dialog', { name: 'Feed eintragen' });
  await again
    .getByRole('textbox', { name: /Adresse des Feeds/ })
    .fill('https://www.blog.example.org/feed.xml');
  await again.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(again.getByRole('alert')).toHaveText('Diesen Feed hast du schon.');
  await again.getByRole('button', { name: 'Abbrechen' }).click();

  // Remove it again.
  await page.getByRole('button', { name: /Aktionen für blog.example.org/ }).click();
  await page.getByRole('menuitem', { name: /Entfernen/ }).click();
  await expect(page.getByText('Noch keine Feeds').first()).toBeVisible();
});

test('Feeds: Vorschläge und Startkatalog mit einem Tipp', async ({ page }) => {
  await enable(page, 'feeds');
  await page.goto('/feeds');
  const suggestions = page.getByTestId('feeds-suggestions');
  await expect(suggestions.getByRole('button', { name: /abonnieren/ })).toHaveCount(3);
  await suggestions.getByRole('button', { name: 'tagesschau.de abonnieren' }).click();
  await expect(page.getByRole('heading', { name: /Nachrichten/ })).toBeVisible();

  await page
    .getByRole('button', { name: /Feed (hinzufügen|eintragen)/ })
    .first()
    .click();
  const finder = page.getByRole('dialog', { name: 'Feed eintragen' });
  await expect(finder.getByTestId('feeds-catalog-added-tagesschau')).toBeVisible();
  await finder.getByRole('searchbox', { name: 'Suchen oder Adresse einfügen' }).fill('Österreich');
  await finder.getByRole('button', { name: 'ORF.at abonnieren' }).click();
  await expect(finder.getByTestId('feeds-catalog-added-orf')).toBeVisible();
  await finder.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('heading', { name: /Lokal/ })).toBeVisible();
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
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Importieren' }).click();
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
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Als OPML exportieren' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^nemo-feeds-\d{4}-\d{2}-\d{2}\.opml$/);
});
