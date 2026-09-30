import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Tools are off by default: switch one on in the library, then open it from the toolbar. */
async function openTool(page: Page, id: string, name: string) {
  await page.goto('/tools');
  await page.getByTestId(`tool-${id}`).getByLabel(`${name} einschalten`).click();
  await expect(page.getByTestId(`tool-${id}`).getByLabel(`${name} einschalten`)).toBeChecked();
  await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
  await page
    .getByRole('dialog', { name: 'Werkzeuge' })
    .getByRole('button', { name, exact: true })
    .click();
  // The dialog is titled after the open tool now.
  return page.getByRole('dialog');
}

test('text tool: counts, changes case, tidies and inserts placeholder text', async ({ page }) => {
  const sheet = await openTool(page, 'text', 'Text-Werkzeug');
  const box = sheet.getByLabel('Text', { exact: true });
  await box.fill('hallo   welt. wie geht es dir?\n\n\nnoch ein Absatz');
  const stats = sheet.getByTestId('text-stats');
  await expect(stats).toContainText('Wörter');
  await expect(stats.locator('li', { hasText: 'Wörter' })).toContainText('9');
  await expect(stats.locator('li', { hasText: 'Absätze' })).toContainText('2');

  await sheet.getByRole('button', { name: 'Satzanfang groß' }).click();
  await expect(box).toHaveValue('Hallo   welt. Wie geht es dir?\n\n\nNoch ein absatz');
  await sheet.getByRole('button', { name: 'GROSS', exact: true }).click();
  await expect(box).toHaveValue(/^HALLO {3}WELT\./);

  await sheet.getByLabel('Leere Zeilen entfernen').check();
  await sheet.getByRole('button', { name: 'Aufräumen', exact: true }).click();
  await expect(box).toHaveValue('HALLO WELT. WIE GEHT ES DIR?\nNOCH EIN ABSATZ');

  await sheet.getByLabel('Absätze', { exact: true }).fill('3');
  await sheet.getByRole('button', { name: 'Blindtext einsetzen' }).click();
  await expect(box).toHaveValue(/^Lorem ipsum dolor sit amet/);
  await expect(stats.locator('li', { hasText: 'Absätze' })).toContainText('3');
});

test('time zones: converts across a date line and summer time, zones can be added and removed', async ({
  page,
}) => {
  const sheet = await openTool(page, 'timezones', 'Zeitzonen');
  await sheet.getByLabel('Ausgangszone').selectOption('Europe/Berlin');
  await sheet.getByLabel('Datum').fill('2026-07-01');
  await sheet.getByLabel('Uhrzeit').fill('23:00');
  const results = sheet.getByTestId('zone-results');
  await expect(sheet.getByTestId('zone-time-UTC')).toHaveText('21:00');
  await expect(sheet.getByTestId('zone-time-America/New_York')).toHaveText('17:00');
  await expect(sheet.getByTestId('zone-time-Asia/Tokyo')).toHaveText('06:00');
  await expect(results.locator('li', { hasText: 'Tokio' })).toContainText('+1 Tag');

  await sheet.getByLabel('Zone hinzufügen').selectOption('Australia/Sydney');
  await sheet.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(sheet.getByTestId('zone-time-Australia/Sydney')).toHaveText('07:00');

  await sheet.getByRole('button', { name: 'UTC (Weltzeit) entfernen' }).click();
  await expect(sheet.getByTestId('zone-time-UTC')).toHaveCount(0);

  // Winter time: the same wall clock gives another offset.
  await sheet.getByLabel('Datum').fill('2026-01-15');
  await expect(sheet.getByTestId('zone-time-America/New_York')).toHaveText('17:00');
  await expect(sheet.getByTestId('zone-time-Asia/Tokyo')).toHaveText('07:00');

  await sheet.getByLabel('Datum').fill('');
  await expect(sheet.getByRole('alert')).toContainText('ungültig');
});

test('image tool: shrinks and converts a picture on the device, then saves it', async ({
  page,
}) => {
  const sheet = await openTool(page, 'image', 'Bilder verkleinern');
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 200;
    const x = c.getContext('2d')!;
    x.fillStyle = '#cc0000';
    x.fillRect(0, 0, 400, 200);
    x.fillStyle = '#0033cc';
    x.fillRect(0, 0, 200, 100);
    return c.toDataURL('image/png');
  });
  await sheet.locator('#image-input').setInputFiles({
    name: 'rot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  });
  await expect(sheet.getByTestId('image-source')).toContainText('400 × 200 Pixel');

  await sheet.getByLabel('Längste Seite (Pixel)').fill('100');
  await sheet.getByRole('button', { name: 'Umwandeln' }).click();
  await expect(sheet.getByTestId('image-result')).toContainText('100 × 50 Pixel');
  await expect(sheet.getByTestId('image-result')).toContainText('WebP');
  await expect(sheet.getByRole('img', { name: 'Vorschau' })).toBeVisible();

  // Crop to a square first: 200 × 200 of the original, scaled to 100.
  await sheet.getByLabel('Zuschneiden (Mitte)').selectOption('1:1');
  await sheet.getByLabel('Format').selectOption('image/jpeg');
  await sheet.getByRole('button', { name: 'Umwandeln' }).click();
  await expect(sheet.getByTestId('image-result')).toContainText('100 × 100 Pixel');
  await expect(sheet.getByTestId('image-result')).toContainText('JPG');

  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  expect((await download).suggestedFilename()).toBe('rot-klein.jpg');
});

test('image tool: a file the browser cannot read gets a clear message', async ({ page }) => {
  const sheet = await openTool(page, 'image', 'Bilder verkleinern');
  await sheet.locator('#image-input').setInputFiles({
    name: 'kaputt.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('das ist kein bild'),
  });
  await expect(sheet.getByRole('alert')).toContainText('HEIC');
});
