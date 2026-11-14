import { expect, test, type Page } from '@playwright/test';
import { enable, mainNav, openNavArea, ready } from './helpers';

/**
 * Gerätestatus (UI audit 2026-11, module package S-b): one page says how this device is doing, on the phone too;
 * it switches nothing (every line is a link into the settings; the one action downloads a backup), the settings point to it only while the module is on,
 * and neither prints an address, a port or a path.
 */
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 900;
const lines = (page: Page) => page.getByTestId('device-status').locator('a[data-testid]');

test('the page: four groups of lines, each a link into the settings, nothing to switch', async ({
  page,
}) => {
  await enable(page, 'device');
  await ready(page, '/device');
  await expect(page.locator('main h1')).toHaveText('Gerätestatus');
  const root = page.getByTestId('device-status');
  for (const group of ['Backup', 'Sync', 'Speicher', 'App'])
    await expect(root.getByRole('list', { name: group })).toBeVisible();
  // The browser has no hub, drive or autostart: the same page with backup, sync, storage, updates and network.
  await expect(lines(page)).toHaveCount(6);
  for (const id of ['overview-backup', 'overview-sync', 'overview-storage', 'overview-updates'])
    await expect(root.getByTestId(id)).toBeVisible();
  await expect(root.getByTestId('device-next-backup')).toContainText('Von Hand');
  await expect(root.getByTestId('device-network')).toContainText('Erlaubt');
  for (const href of await lines(page).evaluateAll((as) => as.map((a) => a.getAttribute('href'))))
    expect(href).toMatch(/^\/settings\//);
  // Nothing to switch; the one button is "Backup herunterladen" (0b-8 follow-up 16, next test).
  await expect(root.getByRole('button')).toHaveText(['Backup herunterladen']);
  await expect(root.getByRole('switch')).toHaveCount(0);
  // A fresh browser has no backup yet: the summary names it calmly (0b-8, maintainer's answer 3).
  await expect(page.getByTestId('device-summary')).toContainText('Noch kein Backup');
  await expect(page.getByText(/Akku|Batterie/)).toHaveCount(0);
  // A line leads to where the thing is set.
  await root.getByTestId('overview-sync').click();
  await expect(page).toHaveURL(/\/settings\/sync$/);
});

test('backup and sync status are two clicks away: System, then the page (phone: Mehr, then System)', async ({
  page,
}) => {
  await enable(page, 'device');
  await ready(page, '/');
  if (isPhone(page)) {
    await mainNav(page).getByRole('button', { name: 'Mehr' }).click(); // tap 1
    // System holds only this module in the browser and on the phone: the area lands on its page.
    await page.getByRole('dialog').getByRole('link', { name: 'System' }).click(); // tap 2
  } else {
    await openNavArea(page, 'System'); // click 1
    await mainNav(page).getByRole('link', { name: 'Gerätestatus' }).click(); // click 2
  }
  await expect(page).toHaveURL(/\/device$/);
  await expect(page.getByTestId('overview-backup')).toBeVisible();
  await expect(page.getByTestId('overview-sync')).toBeVisible();
});

test('a backup from the page: one button opens the export form, the password is recommended, the file comes from the dialog', async ({
  page,
}) => {
  await enable(page, 'device');
  await ready(page, '/device');
  const open = page
    .getByTestId('device-group-backup')
    .getByRole('button', { name: 'Backup herunterladen' });
  // Calm: not the filled colour, no warning words around it.
  await expect(open).toHaveAttribute('data-variant', 'secondary');
  let downloads = 0;
  page.on('download', () => downloads++);
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Backup sichern' });
  await expect(dialog).toContainText('Empfohlen: mit Passwort sichern.');
  const pass = dialog.getByLabel('Passwort für das Backup');
  await expect(pass).toBeFocused();
  expect(downloads).toBe(0); // never a file in one click
  const encrypted = dialog.getByRole('button', { name: 'Verschlüsselt exportieren' });
  await expect(encrypted).toHaveAttribute('data-variant', 'primary');
  await expect(dialog.getByRole('button', { name: 'Ohne Passwort herunterladen' })).toHaveAttribute(
    'data-variant',
    'secondary',
  );

  await pass.fill('ein-langes-passwort');
  const download = page.waitForEvent('download');
  await encrypted.click();
  expect((await download).suggestedFilename()).toMatch(/^nemo-backup-.*\.json$/);
  await expect(dialog).toHaveCount(0);
  // The page now knows a backup exists: the summary no longer says "Noch kein Backup".
  await expect(page.getByTestId('device-summary')).not.toContainText('Noch kein Backup');
});

test('the settings keep their six status lines; with the module on, four of them are one line that leads to the page', async ({
  page,
}) => {
  await ready(page, '/settings');
  const head = page.getByTestId('settings-status');
  await expect(head.getByRole('link')).toHaveCount(6);
  await expect(head.getByTestId('overview-device')).toHaveCount(0);

  await enable(page, 'device');
  await ready(page, '/settings');
  await expect(head.getByRole('link')).toHaveCount(3);
  for (const id of ['overview-security', 'overview-device', 'overview-ai'])
    await expect(head.getByTestId(id)).toBeVisible();
  await head.getByTestId('overview-device').click();
  await expect(page).toHaveURL(/\/device$/);
  await expect(page.getByTestId('overview-sync')).toBeVisible();
});

test('desktop: home-network hub and drive join the page as words and sizes; no port, address, drive letter or path', async ({
  page,
}) => {
  test.skip(isPhone(page), 'the desktop lines exist in the desktop app only');
  await page.addInitScript(() => {
    localStorage.setItem('__tmPlatformKind', 'desktop');
    localStorage.setItem('tm-e2e-lanhub', '1');
  });
  await enable(page, 'device');
  await ready(page, '/device');
  const root = page.getByTestId('device-status');
  await expect(root.getByTestId('device-hub')).toContainText('Heimnetz');
  await expect(root.getByTestId('device-drive')).toContainText(/frei.*auf dem Systemlaufwerk/);
  // CPU, memory and network are not repeated here: the page points to "Dieser PC".
  await expect(page.getByTestId('device-pc')).toContainText('Dieser PC');
  const text = (await page.locator('main').innerText()) ?? '';
  expect(text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  expect(text).not.toMatch(/https?:\/\/|[A-Z]:\\|:\d{4,5}\b|NEMO1:/);
});
