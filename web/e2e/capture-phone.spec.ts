import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/** Erstkontakt-Runde, person C (docs/qa/round-5/c/FINDINGS.md): quick capture on a phone. */
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const openSheet = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).tap();
  return page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).last();
};

test('C05: a sentence that wraps stays fully visible in the field', async ({ page }) => {
  await ready(page, '/');
  const box = await openSheet(page);
  await box.fill('Bremsbeläge bestellen, Mama anrufen morgen 18 Uhr und Garage aufräumen');
  const hidden = await box.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(hidden).toBeLessThanOrEqual(1);
});

test('C04: half-typed text comes back after the app was killed', async ({ page }) => {
  await ready(page, '/');
  const box = await openSheet(page);
  await box.fill('Reifendruck prüfen');
  await page.reload(); // a killed app: the sheet never closed
  await expect(page.locator('main h1')).toBeVisible();
  await expect(await openSheet(page)).toHaveValue('Reifendruck prüfen');
});

test('C01: saving a reminder asks for notifications once', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __asked: number };
    w.__asked = 0;
    class FakeNotification {
      static permission = 'default';
      static async requestPermission() {
        w.__asked += 1;
        FakeNotification.permission = 'denied';
        return 'denied';
      }
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
  });
  await ready(page, '/');
  const box = await openSheet(page);
  await box.fill('erinnere mich in 10 Minuten an Öl nachfüllen');
  await box.press('Enter');
  await expect(page.getByText(/Benachrichtigungen sind aus/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
});
