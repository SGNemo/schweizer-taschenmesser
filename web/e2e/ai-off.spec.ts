import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function openPalette(page: Page) {
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('KI abschalten', () => {
  test('off removes the assistant, the AI entry button and the AI settings; on brings them back', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await expect(page.getByTestId('ai-write-button')).toBeVisible();
    await openPalette(page);
    await page.getByRole('combobox').fill('offene Rechnungen');
    await expect(page.getByRole('option', { name: /Assistent fragen/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await ready(page, '/settings/ki');
    await expect(page.locator('section[aria-labelledby="ai"]')).toBeVisible();
    await page.getByTestId('ai-off').click();
    await page.getByTestId('ai-off-confirm').click();
    await expect(page.getByTestId('ai-on')).toBeVisible();
    // The AI sections are gone, only the way back remains.
    await expect(page.locator('section[aria-labelledby="ai"]')).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="ai-write"]')).toHaveCount(0);

    await ready(page, '/todos');
    await expect(page.getByTestId('ai-write-button')).toHaveCount(0);
    await openPalette(page);
    await page.getByRole('combobox').fill('offene Rechnungen');
    await expect(page.getByRole('option', { name: /Assistent fragen/ })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /Mit KI/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // It survives a reload and is reversible with one button.
    await page.reload();
    await ready(page, '/settings/ki');
    await expect(page.getByTestId('ai-on')).toBeVisible();
    await page.getByTestId('ai-on').click();
    await expect(page.locator('section[aria-labelledby="ai"]')).toBeVisible();
    await ready(page, '/todos');
    await expect(page.getByTestId('ai-write-button')).toBeVisible();
  });

  test('"all devices" is a synced setting; the device flag stays unset', async ({ page }) => {
    await ready(page, '/settings/ki');
    await page
      .getByRole('group', { name: 'Gilt für' })
      .getByRole('button', { name: /Alle Geräte/ })
      .click();
    await page.getByTestId('ai-off').click();
    await page.getByTestId('ai-off-confirm').click();
    await expect(page.getByTestId('ai-on')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tm-ai-off'))).toBeNull();
    await expect(
      page.getByText('Auf allen Geräten dieses Kontos ist keine KI aktiv.'),
    ).toBeVisible();
  });

  test('a device that has AI off shows the way back instead of the AI settings', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('tm-ai-off', '1'));
    await ready(page, '/settings/ki');
    await expect(page.getByTestId('ai-on')).toBeVisible();
  });
});
