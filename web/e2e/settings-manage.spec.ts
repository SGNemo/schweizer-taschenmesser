import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';
const dark = 'html[data-theme="dark"]';
/** The toast's own undo (the history list below has "Rückgängig" buttons too). */
const toastUndo = (page: Page) =>
  page.getByRole('status').getByRole('button', { name: 'Rückgängig' });

test('a profile switches several settings at once and the toast takes them back', async ({
  page,
}) => {
  await ready(page, '/settings/allgemein');
  await expect(page.locator(dark)).toHaveCount(0);
  await page.getByTestId('profile-apply-evening').click();
  await expect(page.locator(dark)).toHaveCount(1);
  // The profile is active exactly while its values are set.
  await expect(page.locator('#profiles--evening').getByText('Aktiv')).toBeVisible();
  await toastUndo(page).click();
  await expect(page.locator(dark)).toHaveCount(0);
  await expect(page.getByTestId('profile-apply-evening')).toBeVisible();
});

test('the quick bar switches the profile in one choice', async ({ page }) => {
  await ready(page, '/settings');
  await page.getByTestId('quick-profile').selectOption({ label: 'Abends' });
  await expect(page.locator(dark)).toHaveCount(1);
  await expect(page.getByTestId('quick-profile')).toHaveValue('evening');
});

test('own profiles: save the current settings, switch back to it, delete with undo', async ({
  page,
}) => {
  await ready(page, '/settings/allgemein');
  await page.getByPlaceholder('Name des Profils').fill('Zuhause');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Profil „Zuhause“ gespeichert').first()).toBeVisible();
  await expect(
    page.locator('section[aria-labelledby="profiles"]').getByText('Zuhause').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Profil „Zuhause“ löschen' }).click();
  await expect(page.getByText('Profil „Zuhause“ gelöscht').first()).toBeVisible();
  await toastUndo(page).click();
  await expect(
    page.locator('section[aria-labelledby="profiles"]').getByText('Zuhause').first(),
  ).toBeVisible();
});

test('a schedule can be added, kept in a day and removed', async ({ page }) => {
  await ready(page, '/settings/allgemein');
  await page.getByRole('button', { name: 'Zeitplan hinzufügen' }).click();
  const row = page.getByTestId('schedule-row');
  await expect(row).toHaveCount(1);
  await row.getByLabel('Uhrzeit').fill('21:30');
  await ready(page, '/settings/allgemein');
  await expect(page.getByTestId('schedule-row').getByLabel('Uhrzeit')).toHaveValue('21:30');
  await page.getByRole('button', { name: 'Zeitplan entfernen' }).click();
  await expect(page.getByTestId('schedule-row')).toHaveCount(0);
});

test('the change history lists a change and takes it back', async ({ page }) => {
  await ready(page, '/settings');
  await page.getByTestId('quick-bar').getByRole('button', { name: 'Dunkel' }).click();
  await expect(page.locator(dark)).toHaveCount(1);
  await ready(page, '/settings/allgemein');
  const list = page.getByTestId('history-list');
  await expect(list).toContainText('Farbschema');
  await list.getByTestId('history-undo').first().click();
  await expect(page.locator(dark)).toHaveCount(0);
  await expect(page.getByText('Noch keine Änderungen.')).toBeVisible();
});

test('the change history can be switched off and cleared', async ({ page }) => {
  await ready(page, '/settings/allgemein');
  await page.getByRole('switch', { name: 'Änderungen merken' }).click();
  await ready(page, '/settings');
  await page.getByTestId('quick-bar').getByRole('button', { name: 'Dunkel' }).click();
  await ready(page, '/settings/allgemein');
  await expect(page.getByText('Noch keine Änderungen.')).toBeVisible();
});

test('export gives a file without secrets, import shows a preview first and can be undone', async ({
  page,
}, info) => {
  await ready(page, '/settings/allgemein');
  await page.locator(dark).count();
  const download = page.waitForEvent('download');
  await page.getByTestId('settings-export').click();
  const file = await (await download).path();
  const text = readFileSync(file, 'utf8');
  expect(text).toContain('"format": "nemo-settings"');
  expect(text).not.toMatch(/autoLock|supporter|token|secret|https?:\/\//i);

  // A file that sets the dark scheme: preview, apply, undo.
  const edited = JSON.stringify({ ...JSON.parse(text), values: { theme: 'dark' } });
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('settings-import').click();
  await (
    await chooser
  ).setFiles({
    name: 'nemo-settings.json',
    mimeType: 'application/json',
    buffer: Buffer.from(edited),
  });
  const preview = page.getByTestId('import-preview');
  await expect(preview).toContainText('ändert 1 Einstellung');
  await expect(preview).toContainText('Farbschema');
  await page.getByTestId('import-apply').click();
  await expect(page.locator(dark)).toHaveCount(1);
  await toastUndo(page).click();
  await expect(page.locator(dark)).toHaveCount(0);
  void info;
});

test('a file that is not a settings file is refused with one calm line', async ({ page }) => {
  await ready(page, '/settings/allgemein');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('settings-import').click();
  await (
    await chooser
  ).setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(
    page.getByRole('alert').filter({ hasText: 'keine Nemo-Einstellungsdatei' }),
  ).toBeVisible();
  await expect(page.locator(dark)).toHaveCount(0);
});

test('palette: "Profil: Abends" switches the profile without leaving the page', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await ready(page, '/settings/darstellung');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('Profil: Abends');
  await page.keyboard.press('Enter');
  await expect(page.locator(dark)).toHaveCount(1);
});

test('the new sections are listed under "Verwalten" and found by the search', async ({
  page,
}, info) => {
  await ready(page, '/settings/allgemein');
  if (!isPhone(info)) {
    await expect(
      page.getByTestId('subnav-allgemein').getByRole('link', { name: 'Verwalten' }),
    ).toBeVisible();
  }
  await ready(page, '/settings');
  await page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' }).fill('Voreinstellung');
  await expect(page.getByRole('link', { name: /Profile/ }).first()).toBeVisible();
});
