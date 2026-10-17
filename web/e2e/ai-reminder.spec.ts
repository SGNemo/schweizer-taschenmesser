import { expect, test, type Page } from '@playwright/test';

test.use({ permissions: ['notifications'] });

const DB = 'taschenmesser';

/** Rows of one table straight from IndexedDB. */
async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    ({ db: name, table: t }) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(t).objectStore(t).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as (Record<string, unknown> & { deletedAt: number | null })[]).filter(
                (r) => r.deletedAt === null,
              ),
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
    { db: DB, table },
  );
}

async function say(page: Page, sentence: string) {
  await page.locator('header button', { hasText: 'Suchen' }).click();
  const box = page.getByRole('combobox');
  await box.fill(sentence);
  await expect(page.getByRole('option').first()).toContainText('Eintragen');
  await box.press('Enter');
  await expect(page.getByTestId('ai-write-preview')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
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
  // Tuesday 2026-09-29, 14:57 local time.
  await page.clock.install({ time: new Date('2026-09-29T14:57:00') });
});

test('say a reminder → preview → saved → the notification appears at that time', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const notes = () => page.evaluate(() => (window as unknown as { __notes: unknown[] }).__notes);

  await say(page, 'Erinner mich um 15 Uhr an die Wäsche');
  await expect(page.getByTestId('ai-tier')).toHaveText('Regeln · 0 Token');

  // The time is the point of the card; nothing is stored before "Speichern".
  const when = page.getByTestId('ai-write-when');
  await expect(when).toContainText('Heute');
  await expect(when).toContainText('15:00');
  await expect(page.getByTestId('ai-write-preview')).toContainText('Wäsche');
  await expect(page.getByRole('button', { name: 'Ändern' })).toBeVisible();
  expect(await rows(page, 'calendar_event')).toHaveLength(0);

  await expect(page.getByTestId('ai-write-confirm')).toHaveText('Speichern');
  await page.getByTestId('ai-write-confirm').click();
  await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
  await expect.poll(async () => (await rows(page, 'calendar_event')).length).toBe(1);
  expect((await rows(page, 'calendar_event'))[0]).toMatchObject({
    title: 'Wäsche',
    kind: 'reminder',
    startDate: '2026-09-29',
    startTime: '15:00',
    notify: { minutesBefore: 0, enabled: true },
  });

  expect(await notes()).toEqual([]); // not yet 15:00
  await page.clock.fastForward(3 * 60_000 + 30_000); // → 15:00:30
  await expect.poll(async () => (await notes()).length).toBe(1);
  expect((await notes())[0]).toEqual([
    'Wäsche',
    expect.objectContaining({ tag: expect.stringContaining('event:') }),
  ]);
});

test('"in 20 Minuten Pizza rausnehmen" becomes a reminder at 15:17', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await say(page, 'In 20 Minuten Pizza rausnehmen');
  await expect(page.getByTestId('ai-write-when')).toContainText('15:17');
  await page.getByTestId('ai-write-confirm').click();
  await expect.poll(async () => (await rows(page, 'calendar_event')).length).toBe(1);
  expect((await rows(page, 'calendar_event'))[0]).toMatchObject({
    title: 'Pizza rausnehmen',
    kind: 'reminder',
    startTime: '15:17',
  });
});

test('without a time 09:00 is proposed, flagged, and can be changed before saving', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await say(page, 'Erinnere mich übermorgen an den Geburtstag von Paula');
  const when = page.getByTestId('ai-write-when');
  await expect(when).toContainText('09:00');
  await expect(when).toContainText('Keine Uhrzeit genannt');

  await page.getByRole('button', { name: 'Ändern' }).click();
  const time = page.getByLabel('Uhrzeit');
  await time.fill('08:30');
  await time.blur();
  await expect(when).toContainText('08:30');
  await expect(when).not.toContainText('Keine Uhrzeit genannt');
  await page.getByTestId('ai-write-confirm').click();
  await expect.poll(async () => (await rows(page, 'calendar_event')).length).toBe(1);
  expect((await rows(page, 'calendar_event'))[0]).toMatchObject({
    startDate: '2026-10-01',
    startTime: '08:30',
  });
});
