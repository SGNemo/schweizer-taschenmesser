import { expect, test, type Page } from '@playwright/test';
import { ready, calendarEntry } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

// Invented calendar feed.
const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:e2e-1@example.test',
  'SUMMARY:Vereinssitzung',
  'DTSTART:20260930T180000',
  'DTEND:20260930T200000',
  'LOCATION:Vereinsheim',
  'DESCRIPTION:Bitte Unterlagen mitbringen',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, if-none-match, if-modified-since',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};

async function useMockSyncServer(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('_secrets', 'readwrite');
          tx.objectStore('_secrets').put({
            key: 'syncConfig',
            value: {
              kind: 'selfHosted',
              url: 'https://sync.example.test',
              token: 'tok-1234567890abcdef', // gitleaks:allow (invented test value)
            },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.route('https://sync.example.test/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (request.url().includes('/v1/proxy')) {
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'text/calendar; charset=utf-8', etag: '"e2e"' },
        body: FEED,
      });
    }
    return route.fulfill({ status: 503, headers: CORS, body: '{}' }); // the sync engine gets nothing
  });
}

test.describe('connectors', () => {
  test('settings list the connectors; Google needs the desktop app, ICS explains the missing proxy', async ({
    page,
  }) => {
    await ready(page, '/settings');
    const google = page.getByTestId('connector-google');
    await expect(google).toBeVisible();
    await expect(google.getByText('Nicht verbunden')).toBeVisible();
    await expect(google.getByText(/nur in der Windows-App/)).toBeVisible();
    await expect(google.getByRole('button', { name: 'Verbinden' })).toHaveCount(0);

    const ics = page.getByTestId('connector-ics');
    await ics.getByLabel('Adresse des Kalenders').fill('webcal://cal.example.test/verein.ics');
    await ics.getByRole('button', { name: 'Kalender hinzufügen' }).click();
    await expect(ics.getByRole('alert')).toContainText('Sync-Server');
    await ics.getByLabel('Adresse des Kalenders').fill('kein url');
    await ics.getByRole('button', { name: 'Kalender hinzufügen' }).click();
    await expect(ics.getByRole('alert')).toContainText('keine gültige Adresse');
  });

  test('an ICS subscription (through the sync server proxy) shows up in the calendar as read-only', async ({
    page,
  }) => {
    await useMockSyncServer(page);
    await ready(page, '/settings');
    const ics = page.getByTestId('connector-ics');
    await ics.getByLabel('Name (optional)').fill('Verein');
    await ics.getByLabel('Adresse des Kalenders').fill('webcal://cal.example.test/verein.ics');
    await ics.getByRole('button', { name: 'Kalender hinzufügen' }).click();
    await expect(ics.getByRole('list', { name: 'Kalender-Abos' })).toContainText('Verein');
    await expect(ics.getByText('Verbunden')).toBeVisible();
    await expect(ics.getByText(/Zuletzt abgeglichen/)).toBeVisible(); // the copy is written by then

    await page.goto('/calendar?view=day&date=2026-09-30');
    const entry = calendarEntry(page, /Vereinssitzung/);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('Extern');
    await entry.click();
    const dialog = page.getByRole('dialog', { name: 'Vereinssitzung' });
    await expect(dialog).toContainText('Quelle: Kalender-Abo (ICS)');
    await expect(dialog).toContainText('Vereinsheim');
    await expect(dialog).toContainText('Bitte Unterlagen mitbringen');
    await expect(dialog).toContainText('nur lesbar');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The question "what is tomorrow" sees it through the calendar contribution, without any network.
    await page.goto('/');
    await page.locator('header button', { hasText: 'Suchen' }).click();
    await page.getByRole('combobox').fill('Was steht morgen an?');
    await page.getByRole('combobox').press('Enter');
    await expect(page.getByTestId('ai-answer')).toContainText('Vereinssitzung');

    // Removing the subscription removes its events again.
    await page.goto('/settings');
    await page
      .getByTestId('connector-ics')
      .getByRole('button', { name: /entfernen/ })
      .click();
    await page.goto('/calendar?view=day&date=2026-09-30');
    await expect(calendarEntry(page, /Vereinssitzung/)).toHaveCount(0);
  });
});

const STATEMENT = [
  'Buchungstag;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Betrag;Waehrung',
  '03.09.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '03.08.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '03.07.26;Streaming Monatsbeitrag;Filmfreund GmbH;-9,99;EUR',
  '01.09.26;Gehalt;Beispiel AG;2.345,67;EUR',
].join('\n');

/** Waits until a table of the app database has at least one row (async writes finish after the UI). */
async function waitForRows(page: Page, table: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (name) =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open('taschenmesser');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const req = db.transaction(name, 'readonly').objectStore(name).count();
              req.onsuccess = () => {
                db.close();
                resolve(req.result);
              };
              req.onerror = () => reject(req.error);
            };
          }),
        table,
      ),
    )
    .toBeGreaterThan(0);
}

async function uploadStatement(page: Page, dialog: ReturnType<Page['getByRole']>) {
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'umsaetze.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(STATEMENT),
  });
}

test.describe('bank statement', () => {
  test('is booked on the chosen account and a second import finds only duplicates', async ({
    page,
  }) => {
    await ready(page, '/finance?tab=transactions');
    // The finance page creates its default account after the title is shown; the statement import
    // needs one ("Lege zuerst ein Konto an."), so do not leave before it exists.
    await waitForRows(page, 'finance_account');
    await page.goto('/settings');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Finanzen' })
      .getByRole('button', { name: 'Startdaten einrichten' })
      .click();
    const dialog = page.getByRole('dialog', { name: /Startdaten/ });
    await dialog.getByRole('button', { name: /Kontoauszug importieren/ }).click();
    await expect(dialog.getByLabel('Buchen auf Konto')).toBeVisible();
    await uploadStatement(page, dialog);
    await expect(dialog.getByText('4 Einträge erkannt')).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: '4 Einträge importieren' }).click();
    await expect(dialog.getByRole('status')).toHaveText('4 Einträge wurden importiert.');
    await dialog.getByRole('button', { name: 'Schließen' }).last().click();

    await page.goto('/finance?tab=transactions');
    await expect(page.getByText('Filmfreund GmbH').first()).toBeVisible();
    await expect(page.getByText('Beispiel AG').first()).toBeVisible();

    await page.goto('/settings');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Finanzen' })
      .getByRole('button', { name: 'Startdaten einrichten' })
      .click();
    const again = page.getByRole('dialog', { name: /Startdaten/ });
    await again.getByRole('button', { name: /Kontoauszug importieren/ }).click();
    await uploadStatement(page, again);
    await expect(again.getByText('Schon vorhanden')).toHaveCount(4, { timeout: 15_000 });
    await expect(again.getByRole('button', { name: /importieren/ })).toBeDisabled();
  });

  test('recurring debits become subscription suggestions', async ({ page }) => {
    await ready(page, '/subscriptions');
    await page.getByRole('button', { name: 'Startdaten einrichten' }).click();
    const dialog = page.getByRole('dialog', { name: /Startdaten/ });
    await dialog.getByRole('button', { name: /Abos im Kontoauszug erkennen/ }).click();
    await uploadStatement(page, dialog);
    await expect(dialog.getByText('1 Eintrag erkannt')).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/Monatlich/)).toBeVisible();
    await dialog.getByRole('button', { name: '1 Eintrag importieren' }).click();
    await expect(dialog.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
    await dialog.getByRole('button', { name: 'Schließen' }).last().click();
    await expect(page.getByText('Filmfreund GmbH').first()).toBeVisible();
  });
});
