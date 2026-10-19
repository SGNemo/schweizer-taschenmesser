import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** The tool is off by default: switch it on in the library, then open it from the toolbar. */
async function openTool(page: Page) {
  await page.goto('/tools');
  const card = page.getByTestId('tool-screenshot');
  await card.getByLabel('Bildschirmfoto einschalten').click();
  await expect(card.getByLabel('Bildschirmfoto einschalten')).toBeChecked();
  await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
  await page
    .getByRole('dialog', { name: 'Werkzeuge' })
    .getByRole('button', { name: 'Bildschirmfoto', exact: true })
    .click();
  return page.getByRole('dialog');
}

/** A stand-in for the browser's screen picker: a 320 × 200 canvas as the "screen". */
const fakeScreen = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const paint = () => {
      ctx.fillStyle = '#336699';
      ctx.fillRect(0, 0, 320, 200);
      requestAnimationFrame(paint);
    };
    paint();
    return canvas.captureStream(15);
  };
};

test.describe('Screenshot tool', () => {
  test('is off by default and appears in the library', async ({ page }) => {
    await page.goto('/tools');
    await expect(
      page.getByTestId('tool-screenshot').getByLabel('Bildschirmfoto einschalten'),
    ).not.toBeChecked();
  });

  test('takes a picture, shows it and saves it as a PNG named after the time', async ({ page }) => {
    await page.addInitScript(fakeScreen);
    const sheet = await openTool(page);
    await sheet.getByRole('button', { name: 'Bildschirm aufnehmen' }).click();
    const preview = sheet.getByTestId('screenshot-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('alt', /320 × 200 Pixel/);

    const download = page.waitForEvent('download');
    await sheet.getByRole('button', { name: 'Speichern' }).click();
    expect((await download).suggestedFilename()).toBe('bildschirmfoto-2026-09-29-1000.png');

    await sheet.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(preview).toHaveCount(0);
  });

  test('with the pause ticked it counts down calmly, then takes the picture', async ({ page }) => {
    await page.addInitScript(fakeScreen);
    const sheet = await openTool(page);
    await sheet.getByLabel('Nach 3 Sekunden aufnehmen').check();
    await sheet.getByRole('button', { name: 'Bildschirm aufnehmen' }).click();
    await expect(sheet.getByTestId('screenshot-countdown')).toContainText('Aufnahme in');
    await expect(sheet.getByTestId('screenshot-preview')).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByTestId('screenshot-countdown')).toHaveCount(0);
  });

  test('the pause can be stopped and nothing is captured', async ({ page }) => {
    await page.addInitScript(fakeScreen);
    const sheet = await openTool(page);
    await sheet.getByLabel('Nach 3 Sekunden aufnehmen').check();
    await sheet.getByRole('button', { name: 'Bildschirm aufnehmen' }).click();
    await sheet.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(sheet.getByText('Nichts aufgenommen.')).toBeVisible({ timeout: 10_000 });
    await expect(sheet.getByTestId('screenshot-preview')).toHaveCount(0);
  });

  test('copies the picture to the clipboard as a PNG', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(fakeScreen);
    const sheet = await openTool(page);
    await sheet.getByRole('button', { name: 'Bildschirm aufnehmen' }).click();
    await sheet.getByRole('button', { name: 'Kopieren' }).click();
    const type = await page.evaluate(async () => (await navigator.clipboard.read())[0]!.types[0]);
    expect(type).toBe('image/png');
  });

  test('a dismissed picker leaves no error, only "Nichts aufgenommen."', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = () =>
        Promise.reject(new DOMException('dismissed', 'NotAllowedError'));
    });
    const sheet = await openTool(page);
    await sheet.getByRole('button', { name: 'Bildschirm aufnehmen' }).click();
    await expect(sheet.getByText('Nichts aufgenommen.')).toBeVisible();
    await expect(sheet.getByTestId('screenshot-preview')).toHaveCount(0);
  });

  test('where the device cannot capture, the tool says so and offers no button', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: undefined });
    });
    const sheet = await openTool(page);
    await expect(sheet.getByTestId('screenshot-unsupported')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Bildschirm aufnehmen' })).toHaveCount(0);
  });
});
