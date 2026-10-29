import { expect, test } from '@playwright/test';

test.use({ permissions: ['notifications'] });

test('game mode: the browser has only the manual switch, no tone settings', async ({ page }) => {
  await page.goto('/settings/benachrichtigungen');
  const mode = page.getByRole('group', { name: 'Immer leise' });
  await expect(mode).toBeVisible();
  await expect(mode.getByRole('button', { name: 'Aus' })).toHaveAttribute('aria-pressed', 'true');
  await expect(mode.getByRole('button', { name: 'Automatisch' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ton testen' })).toHaveCount(0);
  await mode.getByRole('button', { name: 'An' }).click();
  await expect(mode.getByRole('button', { name: 'An' })).toHaveAttribute('aria-pressed', 'true');
  // Kept on this device across a reload.
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Immer leise' }).getByRole('button', { name: 'An' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('game mode on: a due reminder arrives silently', async ({ page }) => {
  await page.addInitScript(() => {
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

  await page.goto('/settings/benachrichtigungen');
  await page
    .getByRole('group', { name: 'Immer leise' })
    .getByRole('button', { name: 'An', exact: true })
    .click();

  await page.goto('/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill('Tabletten nehmen');
  await dialog.getByLabel('Datum').fill('2026-09-29');
  await dialog.getByLabel('Beginn').fill('20:00');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const notes = () =>
    page.evaluate(
      () => (window as unknown as { __notes: [string, { silent?: boolean }][] }).__notes,
    );
  await page.clock.fastForward(90_000);
  await expect.poll(async () => (await notes()).length).toBe(1);
  expect((await notes())[0]?.[1]).toMatchObject({ silent: true });
});
