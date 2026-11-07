import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { backSettled, ready } from './helpers';

const SHEET = 'Umzug von einer anderen App';

/** Palette → the sheet → "Weiß ich nicht" (opens the file chooser at once) → these files. */
async function pickUnknown(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Aus anderer App');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: SHEET });
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await (await chooser).setFiles(files);
  return sheet;
}

const ENEX = `<?xml version="1.0" encoding="UTF-8"?>
<en-export application="Evernote"><note><title>Rezept &amp; Tipps</title>
<content><![CDATA[<en-note><div>Mehl, Zucker</div><div><en-media type="image/png" hash="ab"/></div></en-note>]]></content>
<tag>Küche</tag></note></en-export>`;

test('Umzug: Evernote erkannt (mit Begründung) → Vorschau → Bericht → Rückgängig', async ({
  page,
}) => {
  await ready(page, '/');
  const sheet = await pickUnknown(page, [
    { name: 'Rezepte.enex', mimeType: 'application/xml', buffer: Buffer.from(ENEX) },
  ]);
  await expect(sheet.getByText('Evernote (.enex)')).toBeVisible();
  await expect(sheet.getByText('sicher erkannt')).toBeVisible();
  await expect(sheet.getByText('1 Notiz', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Vorschau öffnen' }).click();

  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await expect(wizard.getByText('1 Eintrag erkannt')).toBeVisible();
  await expect(wizard.getByText(/1 Anhang .* wurde nicht übernommen/)).toBeVisible();
  await wizard.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');

  // Undo takes it back again. The closing wizard pops its history entry first (backSettled), else the goto is aborted.
  await wizard.getByRole('button', { name: 'Rückgängig machen' }).click();
  await backSettled(page);
  await page.goto('/notes');
  await expect(page.getByText('Rezept & Tipps')).toHaveCount(0);
});

test('Abbrechen beim Lesen lässt nichts zurück', async ({ page }) => {
  await ready(page, '/');
  const sheet = await pickUnknown(page, []);
  // Nothing chosen: still on the first step, nothing was written.
  await expect(sheet.getByRole('button', { name: 'Weiß ich nicht' })).toBeVisible();
});

const TODOIST_HEAD =
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT';
const TODOIST_ZIP = Buffer.from(
  zipSync({
    'Haushalt.csv': strToU8(
      [
        TODOIST_HEAD,
        'task,Fenster putzen,,1,1,,,,en,,45,minute',
        'task,Blumen gießen,,4,1,,,every monday,en,,,',
      ].join('\n'),
    ),
    'Arbeit.csv': strToU8([TODOIST_HEAD, 'task,Bericht schreiben,,2,1,,,,en,,,'].join('\n')),
    'Privat.csv': strToU8([TODOIST_HEAD, 'task,Geschenk besorgen,,4,1,,,,de,,,'].join('\n')),
  }),
);

test('Umzug aus Todoist: ZIP → erkannt mit Zählung → Vorschau → Übernehmen → in den Einstellungen rückgängig', async ({
  page,
}) => {
  await ready(page, '/settings/sync');
  const card = page.getByTestId('move-card');
  await expect(card.getByText('Noch kein Umzug')).toBeVisible();
  await card.getByRole('button', { name: 'Umzug starten' }).click();

  const sheet = page.getByRole('dialog', { name: SHEET });
  await expect(sheet.getByText('Schritt 1 von 3')).toBeVisible();
  await sheet.getByRole('button', { name: 'Todoist' }).click();
  await expect(sheet.getByText(/Sicherung als ZIP/)).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: 'Dateien wählen' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'Todoist.zip',
    mimeType: 'application/zip',
    buffer: TODOIST_ZIP,
  });

  await expect(sheet.getByText('Schritt 3 von 3')).toBeVisible();
  await expect(sheet.getByText('Todoist (CSV)')).toBeVisible();
  await expect(sheet.getByText('3 Projekte · 4 Aufgaben')).toBeVisible();
  await expect(sheet.getByText(/Spalten TYPE und CONTENT/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Vorschau öffnen' }).click();

  // One preview for all projects: three new lists and four tasks.
  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await expect(wizard.getByText('7 Einträge erkannt')).toBeVisible();
  await expect(wizard.getByText(/etwa 45 Min/)).toBeVisible();
  await expect(wizard.getByText(/die Wiederholung wurde übernommen/)).toBeVisible();
  await wizard.getByRole('button', { name: '7 Einträge importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('7 Einträge wurden importiert.');
  await wizard.getByRole('button', { name: 'Schließen' }).last().click();
  await backSettled(page);

  // The card lists the move; its undo takes back all of it.
  await expect(card.getByText(/Todoist\.zip/)).toBeVisible();
  await card.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(card.getByText('rückgängig gemacht')).toBeVisible();
  await page.goto('/todos');
  await expect(page.getByText('Fenster putzen')).toHaveCount(0);
});

test('Umzug aus Google Takeout mit zwei Teilen: Zusammenfassung und ganzer Umzug rückgängig', async ({
  page,
}) => {
  await ready(page, '/');
  const zip = Buffer.from(
    zipSync({
      'Takeout/Contacts/Alle.vcf': strToU8(
        'BEGIN:VCARD\nVERSION:3.0\nFN:Anna Beispiel\nBDAY:1985-03-15\nEND:VCARD\n',
      ),
      'Takeout/Calendar/Privat.ics': strToU8(
        'BEGIN:VCALENDAR\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\nBEGIN:VEVENT\nUID:e1\nDTSTART;VALUE=DATE:20261120\nSUMMARY:Konzert im Park\nEND:VEVENT\nEND:VCALENDAR\n',
      ),
    }),
  );
  const sheet = await pickUnknown(page, [
    { name: 'takeout.zip', mimeType: 'application/zip', buffer: zip },
  ]);
  await expect(sheet.getByText('1 Termin', { exact: true })).toBeVisible();
  await expect(sheet.getByText('1 Kontakt', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Vorschau öffnen' }).click();

  for (const part of [1, 2]) {
    const wizard = page.getByRole('dialog', { name: new RegExp(`Teil ${part} von 2`) });
    await wizard.getByRole('button', { name: '1 Eintrag importieren' }).click();
    await expect(wizard.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
    await wizard.getByRole('button', { name: 'Schließen' }).last().click();
  }

  const summary = page.getByRole('dialog', { name: SHEET });
  await expect(summary.getByRole('status')).toHaveText('2 Einträge wurden übernommen.');
  await summary.getByRole('button', { name: 'Ganzen Umzug rückgängig machen' }).click();
  await expect(page.getByText(/2 Einträge? .*entfernt|rückgängig/).first()).toBeVisible();
  await page.goto('/people');
  await expect(page.getByText('Anna Beispiel')).toHaveCount(0);
});
