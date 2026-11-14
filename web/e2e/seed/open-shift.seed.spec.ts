import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * Opening a page does not make it jump (0b-8 acceptance measurement): the first visit of `/weather`, `/lists` and
 * `/chat` after seeding, desktop and phone, sums the layout shifts without recent input from `page.goto` until the page
 * has settled and holds the sum at ≤ 0.05 (the overview's limit, `status-loading.seed.spec.ts`). Weather with a place
 * and the mocked forecast of `e2e/weather-mock.ts`, whose week carries a thunderstorm, so the hint above the head is part
 * of the measurement.
 */
const CLS_MAX = 0.05;

interface Shift {
  at: number;
  value: number;
  sources: string[];
}

async function watchShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: Shift[] };
    w.__cls = 0;
    w.__shifts = [];
    const name = (n: Node | null) => {
      if (!(n instanceof Element)) return n?.nodeName ?? '?';
      const id = n.getAttribute('data-testid');
      return `${n.tagName.toLowerCase()}${id ? `[${id}]` : ''}.${String(n.className).split(' ')[0] ?? ''}`;
    };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          startTime: number;
          sources?: { node: Node | null; previousRect: DOMRect; currentRect: DOMRect }[];
        }[]) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          w.__shifts.push({
            at: Math.round(e.startTime),
            value: Number(e.value.toFixed(4)),
            sources: (e.sources ?? []).map(
              (s) =>
                `${name(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)}`,
            ),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // no layout-shift entries in this browser: the value stays 0
    }
  });
}

/** Waits until `main` has stopped changing, then reads the shift sum and its entries. */
async function settledShift(page: Page): Promise<{ cls: number; shifts: Shift[] }> {
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
  return page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shifts: Shift[] };
    return { cls: w.__cls, shifts: w.__shifts };
  });
}

function report(label: string, result: { cls: number; shifts: Shift[] }) {
  console.log(`${label}: CLS ${result.cls.toFixed(4)}`);
  for (const s of result.shifts)
    if (s.value >= 0.005) console.log(`  @${s.at} ms ${s.value}: ${s.sources.join(', ')}`);
}

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`no layout shift when a page opens – ${device}`, () => {
    test.use({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
      seeded: { scale: 'medium', ...(phone ? {} : { desktop: true }), preview: true },
    });

    test('/weather: the hint above the head and the forecast come together', async ({ page }) => {
      test.setTimeout(120_000);
      const { mockWeather, pickWeatherPlace } = await import('../weather-mock');
      await mockWeather(page);
      await watchShifts(page);
      await startSeeded(page, { phone });
      expect(await pickWeatherPlace(page), 'a place was picked').toBe(true);
      await page.goto('/weather');
      await expect(page.getByTestId('weather-temp')).toBeVisible();
      // The hint above the head stays visible (#791); the mocked week has a thunderstorm on Friday.
      await expect(page.getByTestId('weather-warning')).toBeVisible();
      const result = await settledShift(page);
      report(`/weather ${device}`, result);
      expect(result.cls, 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
    });

    test('/lists: the rows and the add field come together', async ({ page }) => {
      test.setTimeout(120_000);
      await watchShifts(page);
      await startSeeded(page, { phone });
      await page.goto('/lists');
      await expect(page.getByTestId('lists-add')).toBeVisible();
      const result = await settledShift(page);
      report(`/lists ${device}`, result);
      expect(result.cls, 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
    });

    test('/chat: nothing appears above the conversation', async ({ page }) => {
      test.setTimeout(120_000);
      await watchShifts(page);
      await startSeeded(page, { phone });
      await page.goto('/chat');
      await expect(page.locator('main h1').first()).toBeVisible();
      const result = await settledShift(page);
      report(`/chat ${device}`, result);
      expect(result.cls, 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
    });
  });
}
