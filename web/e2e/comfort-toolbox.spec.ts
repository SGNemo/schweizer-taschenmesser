import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

test('palette: "timer 10m" starts a ten minute timer without opening the toolbox', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('timer 10m');
  await page.getByRole('option', { name: /Timer 10 Min\. starten/ }).waitFor();
  await page.keyboard.press('Enter');
  // Ctrl+. opens the toolbox; the timer is already running in the background.
  await page.keyboard.press('Control+.');
  await page.getByRole('button', { name: /Timer/ }).first().click();
  await expect(page.getByRole('timer')).toHaveText(/^(09:5\d|10:00)/);
});

test('palette: "umrechnen 5 km" answers on the spot and copies with Enter', async ({
  page,
}, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page, '/tools');
  const units = page.getByRole('switch', { name: /Einheiten.* einschalten/ });
  await units.click();
  await expect(units).toBeChecked();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('umrechnen 5 km');
  await expect(page.getByRole('option', { name: /^5 km = 5\.000 m/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('5000');
});

test('tool library: search finds a tool by purpose', async ({ page }) => {
  await ready(page, '/tools');
  const search = page.getByRole('searchbox', { name: 'Werkzeuge durchsuchen' });
  await search.fill('qqqunbekanntqqq');
  await expect(page.getByText('Kein Werkzeug passt.')).toBeVisible();
  await search.fill('Timer');
  await expect(page.getByTestId('tool-timer')).toBeVisible();
});

test('toolbox: the tool used last is one tap away above the tiles', async ({ page }, info) => {
  void info;
  await ready(page, '/tools');
  const units = page.getByRole('switch', { name: /Einheiten.* einschalten/ });
  await units.click();
  await expect(units).toBeChecked();
  await page
    .getByTestId('tool-timer')
    .getByRole('button', { name: /Timer.* öffnen/ })
    .click();
  await page.getByRole('button', { name: 'Zurück zu den Werkzeugen' }).click();
  const recent = page.getByRole('region', { name: 'Zuletzt benutzt' });
  await expect(recent.getByRole('button', { name: /Timer/ })).toBeVisible();
});
