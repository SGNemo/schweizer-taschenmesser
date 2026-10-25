import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const TODOIST_CSV = [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
  'section,Haushalt,,,,,,,,',
  'task,Küche aufräumen,,1,1,,,15. Oktober 2026,de,',
  'note,Schubladen zuerst,,,,,,,,',
  'task,Gelbe Säcke holen,,3,2,,,,,',
  'task,Müll rausbringen,,4,1,,,jeden Montag,de,',
].join('\n');

const GOOGLE_JSON = JSON.stringify({
  kind: 'tasks#taskLists',
  items: [
    {
      title: 'Einkäufe',
      items: [
        { id: 'a', title: 'Brot kaufen', status: 'needsAction', due: '2026-10-02T00:00:00.000Z' },
        { id: 'b', title: 'Alte Quittung', status: 'completed' },
      ],
    },
  ],
});

async function openWizard(page: Page, url = '/todos') {
  await ready(page, url);
  const start = page.getByRole('button', { name: 'Startdaten einrichten' });
  // Once the module holds data the button lives in its settings section.
  await (
    url === '/todos'
      ? start
      : page.locator('section[aria-labelledby="module-todos"]').getByRole('button', {
          name: 'Startdaten einrichten',
        })
  ).click();
  const dialog = page.getByRole('dialog', { name: /Startdaten/ });
  await dialog.getByRole('button', { name: /Aus Todoist oder Google Tasks/ }).click();
  return dialog;
}

async function chooseFile(page: Page, name: string, mimeType: string, content: string) {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('dialog', { name: /Startdaten/ })
    .getByRole('button', { name: 'Datei wählen …' })
    .click();
  await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(content, 'utf8') });
}

test('Todoist CSV: file → preview → import → tasks in the list, repeat is only a note', async ({
  page,
}) => {
  const dialog = await openWizard(page);
  await chooseFile(page, 'Haushalt.csv', 'text/csv', TODOIST_CSV);

  await expect(dialog.getByText('3 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText(/wiederholt sich in der Quelle/)).toBeVisible();
  await dialog.getByRole('button', { name: '3 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('3 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await expect(page.getByRole('checkbox', { name: 'Küche aufräumen' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Müll rausbringen' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Gelbe Säcke holen' })).toBeVisible();
});

test('Google Tasks JSON: own list per source list, completed tasks left out, repeat is a duplicate', async ({
  page,
}) => {
  const dialog = await openWizard(page);
  await dialog
    .getByLabel('In diese Liste')
    .selectOption({ label: 'Je Quell-Liste eine eigene Liste' });
  await chooseFile(page, 'Tasks.json', 'application/json', GOOGLE_JSON);

  // One new list plus one open task; the completed one is mentioned, not imported.
  await expect(dialog.getByText('2 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText('1 erledigte Aufgabe wurde nicht mitgenommen.')).toBeVisible();
  await expect(dialog.getByText('Neue Liste')).toBeVisible();
  await dialog.getByRole('button', { name: '2 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('2 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page
    .getByRole('button', { name: /Einkäufe/ })
    .first()
    .click();
  await expect(page.getByRole('checkbox', { name: 'Brot kaufen' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Alte Quittung' })).toHaveCount(0);

  // The same file again: everything is already there.
  const again = await openWizard(page, '/settings/module');
  await again
    .getByLabel('In diese Liste')
    .selectOption({ label: 'Je Quell-Liste eine eigene Liste' });
  await chooseFile(page, 'Tasks.json', 'application/json', GOOGLE_JSON);
  await expect(again.getByText('Schon vorhanden')).toBeVisible();
});

test('an unknown file is explained, nothing is imported', async ({ page }) => {
  const dialog = await openWizard(page);
  await chooseFile(page, 'bank.csv', 'text/csv', 'Datum;Betrag\n1.1.2026;5');
  await expect(dialog.getByText(/Das Format wurde nicht erkannt/)).toBeVisible();
});
