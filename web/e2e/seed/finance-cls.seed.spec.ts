import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * Finance overview without layout shift (perf package finance + mail, docs/perf/FINANCE-MAIL-2026-11.md): the bar
 * charts are plain elements loaded with the overview, so their cards have their final height from the first paint
 * (no "…" while a chart chunk loads). Measured as layout shift (≤ 0.05, the overview's limit) on the seeded
 * Dev-Preview: a fresh load of `/finance` and an in-app visit from the start page, desktop and phone.
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

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`finance overview while it loads – ${device}`, () => {
    test.use({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
      seeded: { scale: 'medium', ...(phone ? {} : { desktop: true }), preview: true },
    });

    test('charts in their place from the first paint, no layout shift', async ({ page }) => {
      test.setTimeout(120_000);
      await watchShifts(page);
      await startSeeded(page, { phone });
      await page.goto('/finance');
      await expect(page.getByTestId('chart-trend')).toBeVisible();
      const fresh = await settledShift(page);
      console.log(`finance ${device}: CLS fresh load ${fresh.toFixed(4)}`);
      expect(fresh, 'layout shift, fresh load').toBeLessThanOrEqual(CLS_MAX);

      await page.goto('/');
      await expect(page.locator('main h1')).toBeVisible();
      await settledShift(page);
      await page.evaluate(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        history.pushState({}, '', '/finance');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await expect(page.getByTestId('chart-categories')).toBeVisible();
      const visit = await settledShift(page);
      console.log(`finance ${device}: CLS in-app visit ${visit.toFixed(4)}`);
      expect(visit, 'layout shift, in-app visit').toBeLessThanOrEqual(CLS_MAX);
      await expect(page.getByText('…', { exact: true })).toHaveCount(0);
    });
  });
}
