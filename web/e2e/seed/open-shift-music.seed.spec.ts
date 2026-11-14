import { expect, type Page } from '@playwright/test';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * Opening the music page does not make it jump (0b-8, the pattern of `open-shift.seed.spec.ts`): `/music` connected
 * through the mocked Spotify account of `e2e/spotify-mock.ts` (a song plays, two devices), desktop and phone. The stage
 * (cover, player) and the page below it depend on the first reads of the connector; the layout shifts without recent
 * input are summed from `page.goto` until the page has settled, on the first visit after connecting and on a second
 * load, and held at ≤ 0.05 (the overview's limit).
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
    const held: { from?: number; to?: number } = {};
    (window as unknown as { __held: typeof held }).__held = held;
    new MutationObserver(() => {
      const on = !!document.querySelector('[data-held]');
      if (on && held.from === undefined) held.from = performance.now();
      if (!on && held.from !== undefined && held.to === undefined) held.to = performance.now();
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-held'],
    });
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
                `${name(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}→${Math.round(s.currentRect.height)}`,
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

/** Opens `/music` and waits for the player and the page below the stage. */
async function openMusic(page: Page, label: string) {
  await page.goto('/music');
  await expect(page.getByTestId('music-now')).toBeVisible();
  await expect(page.getByTestId('music-main')).toBeVisible();
  // How long the frame held the page unpainted (cap 1.5 s), measured in the page from the first `[data-held]` to its
  // removal: logged only, so a drift towards the cap shows in the CI output.
  await expect(page.locator('[data-held]')).toHaveCount(0);
  const held = await page.evaluate(() => {
    const w = window as unknown as { __held?: { from?: number; to?: number } };
    return w.__held?.from !== undefined && w.__held.to !== undefined
      ? Math.round(w.__held.to - w.__held.from)
      : null;
  });
  console.log(`${label}: held ${held ?? '–'} ms`);
}

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`no layout shift when the music page opens – ${device}`, () => {
    test.use({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
      seeded: { scale: 'medium', ...(phone ? {} : { desktop: true }), preview: true },
    });

    test('/music connected: stage, player and page come together', async ({ page }) => {
      test.setTimeout(120_000);
      await mockSpotify(page);
      await watchShifts(page);
      await startSeeded(page, { phone });
      await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);

      await openMusic(page, `/music ${device}, first visit`);
      const first = await settledShift(page);
      report(`/music ${device}, first visit`, first);

      await openMusic(page, `/music ${device}, second visit`);
      const second = await settledShift(page);
      report(`/music ${device}, second visit`, second);

      expect(first.cls, 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
      expect(second.cls, 'layout shift, second visit').toBeLessThanOrEqual(CLS_MAX);
    });
  });
}
