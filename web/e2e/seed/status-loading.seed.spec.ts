import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * Status lines while they load (0b-8, theme C4): the settings head no longer shows six lines that jump to three while
 * the module states load, and `/device` shows its head and lines together once the first reads are back. Measured as
 * layout shift (≤ 0.05, the overview's limit) on the seeded Dev-Preview, where every module is on (so `device` is on
 * and the settings head has three lines): a fresh load of the page and an in-app visit (a link click, the case where
 * the head jumped), desktop and phone.
 */
const CLS_MAX = 0.05;

async function watchShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // no layout-shift entries in this browser: the value stays 0
    }
  });
}

const resetShifts = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __cls: number }).__cls = 0;
  });

/** Waits until `main` has stopped changing, then reads the shift sum. */
async function settledShift(page: Page): Promise<number> {
  let last = '';
  for (let same = 0, i = 0; i < 40 && same < 4; i++) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return `${main.querySelectorAll('*').length}/${main.scrollHeight}/${(main.textContent ?? '').length}`;
    });
    same = now === last ? same + 1 : 0;
    last = now;
  }
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

/** Every count of status lines the settings head showed, from the first paint on. */
async function watchSettingsCounts(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __counts: number[] };
    w.__counts = [];
    const record = () => {
      const n = document.querySelectorAll('[data-testid="settings-status"] a').length;
      if (n > 0) w.__counts.push(n);
    };
    new MutationObserver(record).observe(document.body, { childList: true, subtree: true });
  });
}

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`status lines while they load – ${device}`, () => {
    test.use({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
      seeded: { scale: 'medium', ...(phone ? {} : { desktop: true }), preview: true },
    });

    test('settings: three lines from the first paint on, no layout shift', async ({ page }) => {
      test.setTimeout(120_000);
      await watchShifts(page);
      await startSeeded(page, { phone });
      // Fresh load.
      await page.goto('/settings');
      await expect(page.getByTestId('overview-device')).toBeVisible();
      const fresh = await settledShift(page);
      console.log(`settings ${device}: CLS fresh load ${fresh.toFixed(4)}`);
      expect(fresh, 'layout shift, fresh load').toBeLessThanOrEqual(CLS_MAX);
      await expect(page.getByTestId('settings-status').locator('a')).toHaveCount(3);
      // In-app visit: from the overview to the settings by a link, the way the head jumped from six to three.
      await page.goto('/');
      await expect(page.locator('main h1')).toBeVisible();
      await settledShift(page);
      await watchSettingsCounts(page);
      await resetShifts(page);
      await page.evaluate(() => {
        history.pushState({}, '', '/settings');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.getByTestId('overview-device')).toBeVisible();
      const visit = await settledShift(page);
      console.log(`settings ${device}: CLS in-app visit ${visit.toFixed(4)}`);
      expect(visit, 'layout shift, in-app visit').toBeLessThanOrEqual(CLS_MAX);
      const counts = await page.evaluate(
        () => (window as unknown as { __counts: number[] }).__counts,
      );
      expect(new Set(counts), 'line counts the head showed').toEqual(new Set([3]));
    });

    test('/device: head and lines together, no "Kein Backup" first, no layout shift', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await watchShifts(page);
      await startSeeded(page, { phone });
      // This device has a backup: "Kein Backup" must never stand on the page, not even for a moment.
      await page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open('taschenmesser');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const tx = open.result.transaction('_meta', 'readwrite');
              tx.objectStore('_meta').put({ key: 'backup.file.last', value: { at: Date.now() } });
              tx.oncomplete = () => {
                open.result.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
          }),
      );
      await page.goto('/device');
      await expect(page.getByTestId('device-summary')).toBeVisible();
      const fresh = await settledShift(page);
      console.log(`/device ${device}: CLS fresh load ${fresh.toFixed(4)}`);
      expect(fresh, 'layout shift, fresh load').toBeLessThanOrEqual(CLS_MAX);
      // In-app visit, watching what the page shows from the first change on.
      await page.goto('/');
      await expect(page.locator('main h1')).toBeVisible();
      await settledShift(page);
      await page.evaluate(() => {
        const w = window as unknown as {
          __device: { lines: number; summary: boolean; text: string }[];
        };
        w.__device = [];
        new MutationObserver(() => {
          const root = document.querySelector('[data-testid="device-status"]');
          if (!root) return;
          w.__device.push({
            lines: root.querySelectorAll('a[data-testid]').length,
            summary: !!document.querySelector('[data-testid="device-summary"]'),
            text: root.textContent ?? '',
          });
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      await resetShifts(page);
      await page.evaluate(() => {
        history.pushState({}, '', '/device');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.getByTestId('device-summary')).toBeVisible();
      const visit = await settledShift(page);
      console.log(`/device ${device}: CLS in-app visit ${visit.toFixed(4)}`);
      expect(visit, 'layout shift, in-app visit').toBeLessThanOrEqual(CLS_MAX);
      const seen = await page.evaluate(
        () =>
          (
            window as unknown as {
              __device: { lines: number; summary: boolean; text: string }[];
            }
          ).__device,
      );
      const total = await page.getByTestId('device-status').locator('a[data-testid]').count();
      const withLines = seen.filter((s) => s.lines > 0);
      expect(new Set(withLines.map((s) => s.lines)), 'lines appear together').toEqual(
        new Set([total]),
      );
      expect(
        withLines.every((s) => s.summary),
        'the head comes with the lines',
      ).toBe(true);
      await expect(page.getByTestId('overview-backup')).not.toContainText('Kein Backup');
      expect(
        seen.some((s) => s.text.includes('Kein Backup')),
        '"Kein Backup" for a moment',
      ).toBe(false);
    });
  });
}
