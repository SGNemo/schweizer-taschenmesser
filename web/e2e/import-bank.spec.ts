import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": the statements below are from October 2026. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-31T10:00:00'));
});

const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), 'src/core/io/__fixtures__/bank', name));

/** Waits until a table of the app database has at least one row (async writes finish after the UI). */
async function waitForRows(page: Page, table: string, atLeast = 1) {
  await expect
    .poll(() =>
      page.evaluate(
        (name) =>
          new Promise<number>((resolveCount, reject) => {
            const open = indexedDB.open('taschenmesser');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const req = db.transaction(name, 'readonly').objectStore(name).count();
              req.onsuccess = () => {
                db.close();
                resolveCount(req.result);
              };
              req.onerror = () => reject(req.error);
            };
          }),
        table,
      ),
    )
    .toBeGreaterThanOrEqual(atLeast);
}

async function openBankImport(page: Page): Promise<Locator> {
  await ready(page, '/finance?tab=transactions');
  // The page creates its default account and categories after the title is shown.
  await waitForRows(page, 'finance_account');
  // The twelve default categories are created one after another.
  await waitForRows(page, 'finance_category', 12);
  await page.goto('/settings/module');
  await page
    .locator('section[aria-labelledby="module-finance"]')
    .getByRole('button', { name: 'Importieren' })
    .click();
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog.getByRole('button', { name: /Kontoauszug importieren/ }).click();
  await expect(dialog.getByLabel('Buchen auf Konto')).toBeVisible();
  return dialog;
}

async function upload(
  page: Page,
  dialog: Locator,
  name: string,
  buffer: Buffer,
  mime = 'text/plain',
) {
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (await chooser).setFiles({ name, mimeType: mime, buffer });
}

test('OFX: file → preview names the format → import → bookings', async ({ page }) => {
  const dialog = await openBankImport(page);
  await upload(page, dialog, 'umsaetze.ofx', fixture('sample-sgml.ofx'));
  await expect(dialog.getByText('Erkannt: OFX')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('4 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText('Bäckerei Kaffeeklatsch')).toHaveCount(2);
  await dialog.getByRole('button', { name: '4 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('4 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page.goto('/finance?tab=transactions');
  await expect(page.getByText('Filmfreund GmbH').first()).toBeVisible();
  await expect(page.getByText('Müller & Söhne AG').first()).toBeVisible();
});

test('a bank we know is named in the preview (DKB)', async ({ page }) => {
  const dialog = await openBankImport(page);
  await upload(page, dialog, 'dkb.csv', fixture('dkb-neu.csv'), 'text/csv');
  await expect(dialog.getByText('Erkannt: DKB')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('3 Einträge erkannt')).toBeVisible();
});

const UNKNOWN = [
  'Tag;Summe;Wer;Wofuer',
  '01.10.2026;-12,50;Kiosk Eck;Zeitung',
  '02.10.2026;-3,00;Kiosk Eck;Brezel',
  '03.10.2026;100,00;Oma;Geschenk',
].join('\n');

test('unknown CSV: assign the columns once, the second import is silent and finds everything', async ({
  page,
}) => {
  const dialog = await openBankImport(page);
  await upload(page, dialog, 'umsaetze.csv', Buffer.from(UNKNOWN), 'text/csv');

  // The dialog guesses date and amount; the user adds payee and purpose and continues.
  await expect(dialog.getByRole('heading', { name: 'Welche Spalte ist was?' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog.getByLabel('Datum')).toHaveValue('tag');
  await expect(dialog.getByLabel('Betrag')).toHaveValue('summe');
  await dialog.getByLabel('Empfänger (optional)').selectOption({ label: 'Wer' });
  await dialog.getByLabel('Verwendungszweck (optional)').selectOption({ label: 'Wofuer' });
  await dialog.getByRole('button', { name: 'Spalten übernehmen' }).click();

  await expect(dialog.getByText('3 Einträge erkannt')).toBeVisible();
  await dialog.getByRole('button', { name: '3 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('3 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page.goto('/settings/module');
  await page
    .locator('section[aria-labelledby="module-finance"]')
    .getByRole('button', { name: 'Importieren' })
    .click();
  const again = page.getByRole('dialog', { name: /Importieren/ });
  await again.getByRole('button', { name: /Kontoauszug importieren/ }).click();
  await upload(page, again, 'umsaetze.csv', Buffer.from(UNKNOWN), 'text/csv');
  // No question this time; the remembered assignment reads the file and every row is known.
  await expect(again.getByText('Erkannt: deine gemerkte Spaltenzuordnung')).toBeVisible({
    timeout: 15_000,
  });
  await expect(again.getByRole('heading', { name: 'Welche Spalte ist was?' })).toHaveCount(0);
  await expect(again.getByText('Schon vorhanden')).toHaveCount(3);
  await expect(again.getByRole('button', { name: /importieren/ })).toBeDisabled();
});

const NETFLIX_HEAD =
  'Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung\n';

test('rules: a suggestion becomes a rule on confirmation, the next import is categorised without asking', async ({
  page,
}) => {
  const dialog = await openBankImport(page);
  await upload(
    page,
    dialog,
    'okt.csv',
    Buffer.from(`${NETFLIX_HEAD}01.10.2026;Monatsbeitrag;Netflix International B.V.;-12,99;EUR\n`),
    'text/csv',
  );
  await expect(dialog.getByText('1 Eintrag erkannt')).toBeVisible({ timeout: 15_000 });
  // One calm line, nothing ticked; a rule only exists after "Importieren".
  const suggestion = dialog.getByRole('checkbox', {
    name: /immer in der Kategorie „Abos“ buchen/,
  });
  await expect(suggestion).not.toBeChecked();
  await suggestion.check();
  await expect(dialog.getByText('Regel: Abos')).toBeVisible();
  await dialog.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();

  await page.goto('/settings/module');
  await page
    .locator('section[aria-labelledby="module-finance"]')
    .getByRole('button', { name: 'Importieren' })
    .click();
  const again = page.getByRole('dialog', { name: /Importieren/ });
  await again.getByRole('button', { name: /Kontoauszug importieren/ }).click();
  await upload(
    page,
    again,
    'nov.csv',
    Buffer.from(`${NETFLIX_HEAD}01.11.2026;Monatsbeitrag;NETFLIX INTERNATIONAL B.V.;-12,99;EUR\n`),
    'text/csv',
  );
  await expect(again.getByText('1 Eintrag erkannt')).toBeVisible({ timeout: 15_000 });
  await expect(again.getByText('Regel: Abos')).toBeVisible();
  await expect(again.getByRole('checkbox', { name: /immer in der Kategorie/ })).toHaveCount(0);
});
