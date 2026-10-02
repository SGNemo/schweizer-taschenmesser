import { expect, test, type Page } from '@playwright/test';
import { enable } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  // Links open in a new tab; nothing may actually leave the test machine.
  await page
    .context()
    .route(/^https:\/\/(?!localhost).*/, (route) => route.fulfill({ body: 'ok' }));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('the share page offers only enabled modules and prefills the target', async ({ page }) => {
  await enable(page, 'bookmarks');
  await enable(page, 'notes');
  await page.goto(
    '/share?title=Sch%C3%B6ner%20Weg&text=Schau%20mal%20https%3A%2F%2Fwandern.example%2Fweg',
  );
  await expect(page.getByTestId('shared-content')).toContainText('Schöner Weg');
  await expect(page.getByTestId('share-todos')).toBeVisible();
  await expect(page.getByTestId('share-bookmarks')).toBeVisible();

  await page.getByTestId('share-bookmarks').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Titel')).toHaveValue('Schöner Weg');
  await expect(dialog.getByLabel('Adresse (Link)')).toHaveValue('https://wandern.example/weg');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();

  await page.goBack();
  await page.getByTestId('share-notes').click();
  await expect(page.getByRole('dialog').getByLabel('Titel')).toHaveValue('Schöner Weg');
  await expect(page.getByRole('dialog').getByLabel('Text')).toHaveValue(/wandern\.example/);
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();

  await page.goBack();
  await page.getByTestId('share-todos').click();
  await expect(page.getByPlaceholder('Neue Aufgabe …')).toHaveValue('Schöner Weg');
});

test('a disabled module is not offered and an empty share says so', async ({ page }) => {
  await page.goto('/share?title=Nur%20ein%20Titel');
  await expect(page.getByTestId('share-bookmarks')).toHaveCount(0);
  await expect(page.getByTestId('share-todos')).toBeVisible();
  await page.goto('/share');
  await expect(page.getByText('Es wurde nichts geteilt', { exact: false })).toBeVisible();
});

test('Lesezeichen: add a link, open it, reject unsafe addresses', async ({ page }) => {
  await enable(page, 'bookmarks');
  await page.goto('/bookmarks?view=links');
  await page.getByRole('button', { name: 'Lesezeichen anlegen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Sendung');
  await dialog.getByLabel('Adresse (Link)').fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByText('gültige http(s)-Adresse')).toBeVisible();
  await dialog.getByLabel('Adresse (Link)').fill('dhl.example');
  await dialog.getByLabel('Tags').fill('Pakete');
  await save(page);

  await expect(page.getByRole('heading', { name: 'Pakete', level: 2 })).toBeVisible();
  const popup = page.context().waitForEvent('page');
  await page
    .getByRole('button', { name: /Sendung/ })
    .first()
    .click();
  expect((await popup).url()).toBe('https://dhl.example/');
});

test('a calendar place can be shown on the map', async ({ page }) => {
  await page.goto('/calendar');
  await page.getByRole('button', { name: 'Neuer Termin' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Zahnarzt');
  await expect(dialog.getByRole('button', { name: 'Auf der Karte zeigen' })).toHaveCount(0);
  await dialog.getByLabel('Ort').fill('Musterstraße 1, Beispielstadt');
  const popup = page.context().waitForEvent('page');
  await dialog.getByRole('button', { name: 'Auf der Karte zeigen' }).click();
  const url = new URL((await popup).url());
  expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
  expect(url.searchParams.get('query')).toBe('Musterstraße 1, Beispielstadt');
});

test('a birthday can be congratulated over WhatsApp', async ({ page }) => {
  await enable(page, 'birthdays');
  await page.goto('/birthdays');
  await page.getByRole('button', { name: 'Geburtstag hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Anna');
  await dialog.getByLabel('Geburtsdatum').fill('1985-10-02');
  await save(page);
  const popup = page.context().waitForEvent('page');
  await page.getByRole('button', { name: 'Anna per WhatsApp gratulieren' }).click();
  const url = new URL((await popup).url());
  expect(url.origin + url.pathname).toBe('https://wa.me/');
  expect(url.searchParams.get('text')).toBe('Alles Gute zum Geburtstag, Anna! 🎂');
});
