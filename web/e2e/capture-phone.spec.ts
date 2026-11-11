import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Erstkontakt-Runde, person C (docs/qa/round-5.md, person C): quick capture on a phone. */
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const openSheet = async (page: Page) => {
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
  await expect(page.getByText(/Damit die Erinnerung klingelt/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1);
});

test('C06: a toast never covers the „+“ on the phone', async ({ page }) => {
  await ready(page, '/');
  const plus = page.getByRole('button', { name: 'Schnell hinzufügen' });
  const box = await openSheet(page);
  await box.fill('Ölwechsel');
  await box.press('Enter');
  const toast = page.getByText('Gespeichert in ToDos');
  await expect(toast).toBeVisible();
  const [t, p] = await Promise.all([toast.boundingBox(), plus.boundingBox()]);
  // The toast ends above the „+“, so the next capture is one tap away.
  expect(t!.y + t!.height).toBeLessThanOrEqual(p!.y);
});
