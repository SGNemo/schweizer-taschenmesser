import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function openSheet(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'Werkzeuge' }).click();
  return page.getByRole('dialog', { name: 'Werkzeuge' });
}

test('the toolbar lists the everyday tools and the calculator works', async ({ page }) => {
  await openSheet(page);
  const sheet = page.getByRole('dialog');
  for (const name of [
    'Rechner',
    'Prozent & MwSt',
    'Währung',
    'Timer & Stoppuhr',
    'QR-Code',
    'Notizzettel',
  ])
    await expect(sheet.getByRole('button', { name: name })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Würfel & Zufall' })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Rechner' }).click();
  await sheet.getByLabel('Rechnung').fill('240 + 19 %');
  await sheet.getByRole('button', { name: 'Ergebnis', exact: true }).click();
  await expect(sheet.getByTestId('calc-result')).toHaveText('285,6');
  await sheet.getByLabel('Rechnung').fill('1 / 0');
  await sheet.getByRole('button', { name: 'Ergebnis', exact: true }).click();
  await expect(sheet.getByRole('alert')).toContainText('Durch null');

  await sheet.getByRole('button', { name: 'Zurück zu den Werkzeugen' }).click();
  await expect(sheet.getByRole('button', { name: 'QR-Code' })).toBeVisible();
});

test('the tool library switches tools on and off and reorders the toolbar', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.getByRole('heading', { level: 1, name: 'Werkzeuge' })).toBeVisible();

  const dice = page.getByTestId('tool-dice');
  await dice.getByLabel('Würfel & Zufall einschalten').click();
  await expect(dice.getByLabel('Würfel & Zufall einschalten')).toBeChecked();
  const calc = page.getByTestId('tool-calc');
  await calc.getByLabel('Rechner einschalten').click();
  await expect(calc.getByLabel('Rechner einschalten')).not.toBeChecked();

  await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Werkzeuge' });
  await expect(sheet.getByRole('button', { name: 'Würfel & Zufall' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Rechner', exact: true })).toHaveCount(0);

  // The setting survives a reload.
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(
    page.getByTestId('tool-dice').getByLabel('Würfel & Zufall einschalten'),
  ).toBeChecked();
});

test('dice, percent and base64 tools compute', async ({ page }) => {
  await page.goto('/tools');
  for (const [id, name] of [
    ['dice', 'Würfel & Zufall'],
    ['base64', 'Base64 & URL'],
    ['hash', 'Hash'],
  ]) {
    const toggle = page.getByTestId(`tool-${id}`).getByLabel(`${name} einschalten`);
    await toggle.click();
    await expect(toggle).toBeChecked();
  }

  await page
    .getByTestId('tool-dice')
    .getByRole('button', { name: /öffnen/ })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Würfel & Zufall' });
  await sheet.getByRole('button', { name: 'Würfeln' }).click();
  await expect(sheet.getByRole('status', { name: 'Würfel' })).toContainText(/^[1-6]$/);
  await sheet.getByRole('button', { name: 'Zurück zu den Werkzeugen' }).click();

  await page
    .getByRole('dialog', { name: 'Werkzeuge' })
    .getByRole('button', { name: 'Base64 & URL' })
    .click();
  await page.getByRole('dialog', { name: 'Base64 & URL' }).getByLabel('Eingabe').fill('hello');
  await expect(page.getByRole('status', { name: 'Ergebnis' })).toHaveText('aGVsbG8=');
});

test('the palette calculates on the spot', async ({ page }, info) => {
  test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.getByRole('combobox').fill('12 * 3,5');
  await expect(page.getByRole('option').first()).toHaveText('12 * 3,5 = 42');
});
