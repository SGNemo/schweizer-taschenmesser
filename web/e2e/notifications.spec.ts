import { expect, test } from '@playwright/test';

test.use({ permissions: ['notifications'] });

test('a due reminder fires a notification while the app is open', async ({ page }) => {
  await page.addInitScript(() => {
    // Record notifications instead of showing them (no service worker in E2E).
    const w = window as unknown as { __notes: [string, NotificationOptions | undefined][] };
    w.__notes = [];
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = () => Promise.resolve('granted');
      constructor(title: string, options?: NotificationOptions) {
        w.__notes.push([title, options]);
      }
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  });
  await page.clock.install({ time: new Date('2026-09-29T19:59:00') });

  // The OS popup is what this test is about: the in-app card is off by default, so it must still fire.
  await page.goto('/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill('Tabletten nehmen');
  await dialog.getByLabel('Datum').fill('2026-09-29');
  await dialog.getByLabel('Beginn').fill('20:00');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); // write is done once the dialog closed
  await expect(page.getByRole('button', { name: /Tabletten nehmen/ })).toBeVisible();

  const notes = () => page.evaluate(() => (window as unknown as { __notes: unknown[] }).__notes);
  expect(await notes()).toEqual([]);

  await page.clock.fastForward(90_000); // → 20:00:30, the scheduler interval fires once
  await expect.poll(async () => (await notes()).length).toBe(1);
  expect(await notes()).toEqual([
    [
      'Tabletten nehmen',
      expect.objectContaining({
        tag: expect.stringContaining('event:'),
        data: { url: '/calendar?view=day&date=2026-09-29' },
      }),
    ],
  ]);

  // Firing again for the same window must not duplicate it.
  await page.clock.fastForward(60_000);
  expect((await notes()).length).toBe(1);
});

test('settings show the notification permission', async ({ page }) => {
  // Headless Chromium builds differ in how they report a granted permission: pin it.
  await page.addInitScript(() => {
    (window as unknown as { Notification: unknown }).Notification = class {
      static permission = 'granted';
      static requestPermission = () => Promise.resolve('granted');
    };
  });
  await page.goto('/settings/benachrichtigungen');
  await expect(page.getByTestId('notification-status')).toHaveText('Aktiviert');
  await expect(page.getByRole('button', { name: 'Testbenachrichtigung senden' })).toBeVisible();
});

test('push explains that it needs the sync server', async ({ page }) => {
  await page.goto('/settings/benachrichtigungen');
  await expect(page.getByTestId('push-status')).toContainText('Sync-Server');
  await expect(page.getByRole('button', { name: 'Push aktivieren' })).toHaveCount(0);
});
