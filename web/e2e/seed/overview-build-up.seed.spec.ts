import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, startSeeded } from './guards';

/**
 * The overview builds up in grid order (decision "Overview builds up in grid order", `home/masonry.ts`): first a row
 * of cards, then the rest together, and nothing shown moves. `overview.seed.spec.ts` runs at full speed, where a page
 * has its data before anything paints; here the CPU is slowed down, so the cards arrive one after the other.
 */
const CLS_MAX = 0.05;

/** Lazy widgets and their data arrive at their own pace: waits until the page has stopped changing. */
async function settled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
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
}

test.describe('overview – build-up under load', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });

  // The guard above runs at full speed, where a page has its data before anything paints. With the CPU slowed down
  // the cards arrive one after the other: "Ausführlich" on a wide window, with the most cards, shows whether they
  // build up without pushing anything (decision "Overview builds up in grid order"). Both visits: after a reload and
  // coming back.
  test('desktop "Ausführlich", CPU 4×: the cards build up without a layout shift', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem('tm-home-view', 'all');
      const w = window as unknown as { __cls: number; __armed: boolean };
      w.__cls = 0;
      w.__armed = false;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[])
            if (w.__armed && !e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift' });
      } catch {
        // no layout-shift entries in this browser: the value stays 0
      }
    });
    await startSeeded(page, { phone: false });
    const cdp = await page.context().newCDPSession(page);
    const visit = async (reload: boolean) => {
      if (reload) await page.goto('/todos');
      else
        await page.evaluate(() => {
          history.pushState({}, '', '/todos');
          dispatchEvent(new PopStateEvent('popstate'));
        });
      await expect(page.locator('main h1')).toBeVisible();
      await settled(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => {
        const w = window as unknown as { __cls: number; __armed: boolean };
        w.__cls = 0;
        w.__armed = true;
        history.pushState({}, '', '/');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      // Built up: the grid has its cards, none waits and the grid no longer settles.
      const grid = page.getByTestId('home-grid');
      await expect(grid.locator('> [data-testid^="widget-"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(grid.locator('> [data-wait]')).toHaveCount(0, { timeout: 30_000 });
      await expect(grid).not.toHaveAttribute('data-settling', /.*/, { timeout: 30_000 });
      await settled(page);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      return cls;
    };
    expect(await visit(true), 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
    expect(await visit(false), 'layout shift, coming back').toBeLessThanOrEqual(CLS_MAX);
  });
});
