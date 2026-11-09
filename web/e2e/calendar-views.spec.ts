import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

test.describe('Calendar: year, agenda and week numbers (plan group)', () => {
  test('the year view lists twelve months and jumps to a day', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=year&date=2026-11-03');
    await expect(page.getByRole('region', { name: 'Dezember' })).toBeVisible();
    await page
      .getByRole('region', { name: 'Dezember' })
      .getByRole('button', { name: /24\. Dezember/ })
      .click();
    await expect(page).toHaveURL(/view=day&date=2026-12-24/);
  });

  test('the month view shows the week number column', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=month&date=2026-11-03');
    await expect(page.getByRole('rowheader', { name: '45' }).first()).toBeVisible();
  });

  test('the agenda view opens', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=agenda&date=2026-11-03');
    await expect(page.getByRole('button', { name: 'Agenda', pressed: true })).toBeVisible();
  });
});

/** Six untimed entries on Thursday 5 Nov, timed blocks at 08:00 (today) and 07:30 (Wednesday), straight into IndexedDB. */
async function busyWeek(page: Page) {
  await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
  await ready(page, '/calendar');
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const env = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
          const tx = db.transaction(['calendar_event'], 'readwrite');
          const store = tx.objectStore('calendar_event');
          for (let i = 0; i < 6; i++)
            store.put({
              id: `allday${i}`,
              title: `Ganztags ${i + 1}`,
              allDay: true,
              startDate: '2026-11-05',
              ...env,
            });
          store.put({
            id: 'early',
            title: 'Frühstart',
            allDay: false,
            startDate: '2026-11-03',
            startTime: '08:00',
            endTime: '09:00',
            ...env,
          });
          store.put({
            id: 'earlier',
            title: 'Halb acht',
            allDay: false,
            startDate: '2026-11-04',
            startTime: '07:30',
            endTime: '08:30',
            ...env,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

const thursdayCell = (page: Page) =>
  page.locator('main td', { has: page.getByRole('button', { name: /^Donnerstag, 5\. November/ }) });

test.describe('Calendar: month lines, all-day pane, phone toolbar (UI round 6: S03, S04, U25)', () => {
  test.describe('desktop', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.skip(({ isMobile }) => isMobile, 'month lines and the hour grid are desktop layouts');

    test('a month cell names three entries as lines, the rest as "+n weitere" that opens the day', async ({
      page,
    }) => {
      await busyWeek(page);
      await page.goto('/calendar?view=month&date=2026-11-03');
      const cell = thursdayCell(page);
      await expect(cell.getByRole('button', { name: /^Ganztags/ })).toHaveCount(3);
      // Lines, not pills: no entry has a surface of its own (only own events with a time … here: none is timed).
      const backgrounds = await cell
        .getByRole('button', { name: /^Ganztags/ })
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopWidth));
      expect(backgrounds.every((w) => w === '0px')).toBe(true);
      await cell.getByRole('button', { name: '+3 weitere' }).click();
      await expect(page).toHaveURL(/view=day&date=2026-11-05/);
    });

    test('the all-day pane holds three entries per day, and no timed block hides under it', async ({
      page,
    }) => {
      await busyWeek(page);
      await page.goto('/calendar?view=week&date=2026-11-03');
      const grid = page.getByRole('group', { name: 'Zeitraster' });
      const pane = grid.getByRole('group', { name: 'Ganztägig und ohne Uhrzeit' });
      await expect(pane.getByRole('button', { name: /^Ganztags/ })).toHaveCount(3);
      await expect(pane.getByRole('button', { name: /^\+3 weitere, Donnerstag/ })).toBeVisible();
      const early = grid.getByRole('button', { name: /Frühstart/ });
      const earlier = grid.getByRole('button', { name: /Halb acht/ });
      await expect(early).toBeVisible();
      const paneBox = (await pane.boundingBox())!;
      // The grid opens on the full hour before a block that crosses its top edge (07:30–08:30 → 07:00).
      await expect
        .poll(async () => (await earlier.boundingBox())!.y)
        .toBeGreaterThanOrEqual(paneBox.y + paneBox.height - 1);
      expect((await early.boundingBox())!.y).toBeGreaterThanOrEqual(paneBox.y + paneBox.height - 1);
      // Eight full hours stay visible inside the grid.
      const body = grid.locator('div[class*="tgBody"]');
      const { height, hour } = await body.evaluate((el) => ({
        height: el.clientHeight,
        hour: el.scrollHeight / 24,
      }));
      expect(height).toBeGreaterThanOrEqual(8 * hour - 1);
      await pane.getByRole('button', { name: /^\+3 weitere, Donnerstag/ }).click();
      await expect(page).toHaveURL(/view=day&date=2026-11-05/);
      // The day view shows every untimed entry of the day.
      await expect(
        page
          .getByRole('group', { name: 'Ganztägig und ohne Uhrzeit' })
          .getByRole('button', { name: /^Ganztags/ }),
      ).toHaveCount(6);
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 412, height: 915 } });

    test('a month cell never shows a cut text fragment', async ({ page }) => {
      await busyWeek(page);
      await page.goto('/calendar?view=month&date=2026-11-03');
      await expect(thursdayCell(page)).toBeVisible();
      const cut = await page.locator('main table td').evaluateAll((cells) =>
        cells.flatMap((td) =>
          [...td.querySelectorAll<HTMLElement>('span, button')]
            .filter(
              (el) =>
                el.children.length === 0 &&
                (el.textContent ?? '').trim() !== '' &&
                getComputedStyle(el).visibility !== 'hidden' &&
                el.offsetParent !== null &&
                // only a box that clips its text can cut it (a day number's touch strip overflows on purpose)
                getComputedStyle(el).overflowX === 'hidden' &&
                (el.scrollWidth > el.clientWidth + 1 ||
                  (el.textContent ?? '').trim().endsWith('…')),
            )
            .map((el) => el.textContent),
        ),
      );
      expect(cut).toEqual([]);
      // Thursday shows its entries as marks and a count.
      await expect(thursdayCell(page)).toContainText('+3');
    });

    test('the toolbar takes at most three rows; the view switch shows every label in full', async ({
      page,
    }) => {
      await busyWeek(page);
      await page.goto('/calendar?view=month&date=2026-11-03');
      const main = page.locator('main');
      const views = main
        .getByRole('group', { name: 'Ansicht' })
        .filter({ has: page.getByRole('button', { name: 'Monat' }) });
      // "Mehr Felder anzeigen" moved into the "⋯" menu.
      await expect(main.getByRole('switch', { name: 'Mehr Felder anzeigen' })).toHaveCount(0);
      const controls = [
        // the toolbar's button (the head band may name one too until U15 lands)
        main.getByRole('button', { name: 'Neuer Termin' }).last(),
        main.getByRole('button', { name: 'Heute', exact: true }),
        views,
      ];
      const tops = new Set<number>();
      for (const c of controls) tops.add(Math.round((await c.boundingBox())!.y / 8));
      expect(tops.size).toBeLessThanOrEqual(3);
      const clipped = await views.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped).toBe(false);
      const table = (await main.locator('table').boundingBox())!;
      const toolbarTop = (await controls[0]!.boundingBox())!.y;
      // Three rows of 44 px plus their gaps, no more.
      expect(table.y - toolbarTop).toBeLessThan(3 * 44 + 3 * 16 + 8);
    });
  });
});
