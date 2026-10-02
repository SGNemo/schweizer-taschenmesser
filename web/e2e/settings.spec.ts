import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';
const categoryNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Einstellungs-Kategorien' });

test('desktop: /settings opens the first category; the list navigates and Back works', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'master-detail layout is desktop only');
  await ready(page, '/settings');
  await expect(page).toHaveURL(/\/settings\/allgemein$/);
  const nav = categoryNav(page);
  await expect(nav.getByRole('link', { name: 'Allgemein' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await nav.getByRole('link', { name: 'Sync & Backup' }).click();
  await expect(page).toHaveURL(/\/settings\/sync$/);
  await expect(page.getByRole('heading', { name: 'Synchronisation' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Sync & Backup' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/allgemein$/);
  // The developer category does not exist in a stable build.
  await expect(nav.getByRole('link', { name: 'Entwickler' })).toHaveCount(0);
});

test('phone: the categories are the first level, the back link returns to the list', async ({
  page,
}, info) => {
  test.skip(!isPhone(info), 'category list is the phone layout');
  await ready(page, '/settings');
  await expect(page).toHaveURL(/\/settings$/);
  const list = categoryNav(page);
  await expect(list.getByRole('link', { name: /Darstellung/ })).toContainText('Farbschema');
  await list.getByRole('link', { name: /Darstellung/ }).click();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
  await expect(page.getByRole('group', { name: 'Farbschema' })).toBeVisible();
  await page.getByRole('link', { name: 'Einstellungen', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
});

test('search finds a setting by its description, jumps there and highlights it', async ({
  page,
}) => {
  await ready(page, '/settings');
  await page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' }).fill('Tastenkürzel');
  const hit = page.getByRole('link', { name: /Tastenkürzel/ }).first();
  await expect(hit).toContainText('Schnellerfassung');
  await hit.click();
  await expect(page).toHaveURL(/\/settings\/schnellerfassung#quickcapture--hotkey$/);
  await expect(page.getByRole('heading', { name: 'Schnellerfassung' })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="quickcapture"]')).toHaveAttribute(
    'data-highlight',
    'true',
  );
});

test('a deep link scrolls to its section; old #anchors still arrive', async ({ page }) => {
  await ready(page, '/settings/sync#backup');
  await expect(page.locator('section[aria-labelledby="backup"]')).toHaveAttribute(
    'data-highlight',
    'true',
  );
  await page.goto('/settings#ai');
  await expect(page).toHaveURL(/\/settings\/ki#ai$/);
  await expect(page.getByRole('heading', { name: 'KI-Assistent' })).toBeVisible();
});

test('a link from another page lands in the right category', async ({ page }) => {
  await ready(page, '/calendar?tab=reminders');
  await page.getByRole('link', { name: 'Benachrichtigungen aktivieren' }).click();
  await expect(page).toHaveURL(/\/settings\/benachrichtigungen#notifications$/);
  await expect(page.getByTestId('notification-status')).toBeVisible();
});

test('the command palette reaches a single setting', async ({ page }, info) => {
  test.skip(isPhone(info), 'palette keyboard flow is a desktop feature');
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Einstellung: Tastenkürzel');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings\/schnellerfassung#quickcapture--hotkey$/);
});

test('module settings are reachable; the vault settings sit under Sicherheit', async ({ page }) => {
  await ready(page, '/settings/module');
  const todos = page.locator('section[aria-labelledby="module-todos"]');
  await expect(todos.getByRole('switch', { name: 'Erledigte Aufgaben anzeigen' })).toBeVisible();
  await enable(page, 'accounts');
  await ready(page, '/settings/sicherheit');
  await expect(page.getByRole('group', { name: 'Tresor sperren nach Inaktivität' })).toBeVisible();
  await ready(page, '/settings/module');
  await expect(page.locator('section[aria-labelledby="module-accounts"]')).toHaveCount(0);
});

test('Über Nemo shows the version and the facts of this installation', async ({ page }) => {
  await ready(page, '/settings/ueber');
  await expect(page.getByTestId('about-version')).toHaveText(/\d+\.\d+\.\d+/);
  await expect(page.getByText('Plattform', { exact: true })).toBeVisible();
  await expect(page.getByText('MIT-Lizenz')).toBeVisible();
  await page.getByText('Verwendete Bibliotheken').click();
  await expect(page.getByText(/^react \d/)).toBeVisible();
});

test('the danger zone needs the typed phrase and then wipes this device', async ({ page }) => {
  await ready(page, '/todos?list=inbox');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Erfundene Aufgabe');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Erfundene Aufgabe' })).toBeVisible();

  await ready(page, '/settings/ueber');
  await page.getByRole('button', { name: 'Alle Daten auf diesem Gerät löschen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Alle Daten auf diesem Gerät löschen?' });
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Tippe „LÖSCHEN“/).fill('löschen bitte');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Tippe „LÖSCHEN“/).fill('LÖSCHEN');
  await expect(confirm).toBeEnabled();
  // The page reloads once the database is gone.
  await Promise.all([page.waitForEvent('load'), confirm.click()]);
  await expect(page.locator('main h1')).toBeVisible();
  await ready(page, '/todos?list=inbox');
  await expect(page.getByRole('checkbox', { name: 'Erfundene Aufgabe' })).toHaveCount(0);
});
