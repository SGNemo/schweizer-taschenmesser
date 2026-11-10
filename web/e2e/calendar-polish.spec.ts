import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * UI round 6, calendar small fixes (docs/qa/round-6: U05, U15, U16, U17, U27a, U35, U58): each check
 * measures what the finding measured.
 */

const LONG = 'Emma Auerbacher wird heute vierunddreißig Jahre alt';

/** A birthday-like all-day entry with a long title, a timed meeting later today, a reminder and
 * past slots with long titles (for "Zuletzt"), straight into IndexedDB. */
async function fill(page: Page, time = '10:00') {
  await page.clock.install({ time: new Date(`2026-11-03T${time}:00`) });
  await ready(page, '/calendar');
  await page.evaluate(
    (long) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const env = { updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
          const tx = db.transaction(['calendar_event'], 'readwrite');
          const store = tx.objectStore('calendar_event');
          store.put({
            id: 'long',
            title: long,
            allDay: true,
            startDate: '2026-11-04',
            createdAt: 1,
            ...env,
          });
          store.put({
            id: 'meet',
            title: 'Teammeeting',
            allDay: false,
            startDate: '2026-11-03',
            startTime: '14:00',
            endTime: '15:00',
            createdAt: 2,
            ...env,
          });
          store.put({
            id: 'dentist',
            title: 'Zahnarzt Dr. Beispiel mit Kontrolle und Reinigung',
            allDay: false,
            startDate: '2026-10-20',
            startTime: '15:30',
            endTime: '16:15',
            createdAt: 3,
            ...env,
          });
          for (const [id, title, startTime, endTime] of [
            ['run', 'Lauftreff', '07:00', '08:00'],
            ['brunch', 'Brunch', '16:00', '17:00'],
          ])
            store.put({
              id,
              title,
              allDay: false,
              startDate: '2026-10-25',
              startTime,
              endTime,
              createdAt: 3,
              ...env,
            });
          store.put({
            id: 'rem',
            title: 'Paket abholen',
            kind: 'reminder',
            allDay: false,
            startDate: '2026-11-03',
            startTime: '17:30',
            notify: { minutesBefore: 0, enabled: true },
            createdAt: 4,
            ...env,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    LONG,
  );
}

test.describe('Calendar polish (UI round 6)', () => {
  test('U05: on the phone a week row puts the title first, time and kind below it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await fill(page);
    await page.goto('/calendar?view=week&date=2026-11-03');
    const row = page.locator('main li').filter({ hasText: LONG }).first();
    const title = row.getByText(LONG);
    const time = row.getByText('Ganztägig');
    await expect(title).toBeVisible();
    const t = (await title.boundingBox())!;
    const m = (await time.boundingBox())!;
    expect(m.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
    // the title takes the row's width, not a column of ≈ 120 px
    expect(t.width).toBeGreaterThan(250);
  });

  test('U15: an empty calendar offers "Neuer Termin" once', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=month&date=2026-11-03');
    await expect(page.getByTestId('calendar-free')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Neuer Termin' })).toHaveCount(1);
  });

  test('U16 + U17: one heading size, and the head keeps its height on the reminders tab', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop head and split agenda');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await fill(page);
    await page.goto('/calendar?view=week&date=2026-11-03');
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
    const size = (name: string | RegExp) =>
      main.getByRole('heading', { name, level: 2 }).evaluate((el) => getComputedStyle(el).fontSize);
    const nav = await size(/KW 45/);
    expect(await size('Agenda')).toBe(nav);
    const frame = page.getByTestId('module-frame');
    await expect(page.getByTestId('calendar-next')).toBeVisible();
    const before = (await frame.boundingBox())!.height;

    await main.getByRole('button', { name: 'Erinnerungen' }).click();
    await expect(page.getByTestId('reminders-next')).toHaveText(
      /Nächste Erinnerung in 7 Std 30 Min/,
    );
    expect((await frame.boundingBox())!.height).toBe(before);
    expect(await size('Erinnerungen')).toBe(nav);
  });

  test('U27a: the "Wie zuletzt" chips are one title line with the time below', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop dialog width');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await fill(page);
    await page.goto('/calendar?view=month&date=2026-11-03');
    await page.locator('main').getByRole('button', { name: 'Neuer Termin' }).click();
    const group = page.getByRole('dialog').getByRole('group', { name: 'Wie zuletzt' });
    const chips = group.getByRole('button');
    await expect(chips).toHaveCount(4);
    // Layout heights, read in one go: the dialog opens with a short scale animation, and a bounding box read
    // while it runs is scaled with it (chip after chip, so the first ones came out smaller than the last).
    const heights = new Set(await chips.evaluateAll((els) => els.map((el) => el.offsetHeight)));
    expect(heights.size).toBe(1);
    const long = group.getByRole('button', { name: /Zahnarzt/ });
    await expect(long).toHaveAccessibleName(
      'Zahnarzt Dr. Beispiel mit Kontrolle und Reinigung 15:30–16:15',
    );
    // two lines: the title (cut with an ellipsis) and the time
    const lineHeight = await long.evaluate(
      (el) => parseFloat(getComputedStyle(el).lineHeight) || 24,
    );
    expect(await long.evaluate((el) => el.offsetHeight)).toBeLessThan(lineHeight * 2 + 24);
  });

  test('U35: the scrolling hour grid can be reached with the keyboard', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the phone shows a list, no hour grid');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await fill(page);
    await page.goto('/calendar?view=week&date=2026-11-03');
    await expect(page.getByRole('region', { name: 'Stunden' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('main')
      .withRules(['scrollable-region-focusable'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('S04 follow-up: at night the week grid opens around the day, not on empty night hours', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the phone shows a list, no hour grid');
    await page.setViewportSize({ width: 1536, height: 864 });
    await fill(page, '04:45');
    await page.goto('/calendar?view=week&date=2026-11-03');
    const body = page.getByRole('region', { name: 'Stunden' });
    await expect(body).toBeVisible();
    const hourAtTop = await body.evaluate((el) =>
      Math.round((el.scrollTop / el.scrollHeight) * 24),
    );
    // first choice: 08:00 → opens at 06:00 (before: now − 1.5 h → 03:00)
    expect(hourAtTop).toBe(6);
  });

  test("Week look: all-day entries are the month's lines, blocks have no frame", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the phone shows a list, no hour grid');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await fill(page);
    await page.goto('/calendar?view=week&date=2026-11-03');
    const allDay = page.getByRole('group', { name: 'Ganztägig und ohne Uhrzeit' });
    const line = allDay.getByRole('button', { name: LONG });
    await expect(line).toBeVisible();
    // no pill: no border, the kind is a mark in front of the title
    expect(await line.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
    await expect(line.locator('[data-kind]')).toHaveCount(1);
    const block = page
      .getByRole('region', { name: 'Stunden' })
      .getByRole('button', { name: /Teammeeting/ });
    expect(await block.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe('0px');
    await expect(block.locator('[data-kind]')).toHaveCount(1);
  });

  test('U58: the month names of the year view are touch targets on the phone', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=year&date=2026-11-03');
    const buttons = page.locator('main section h3 button');
    await expect(buttons).toHaveCount(12);
    for (const b of await buttons.all()) {
      const box = (await b.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});
