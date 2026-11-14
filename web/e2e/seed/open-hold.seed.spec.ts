import { expect, type Page } from '@playwright/test';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * How long Wetter, Listen, Chat and Musik hold what waits for their first reads (0b-8 follow-up d), measured, not
 * judged. Per run two numbers: `held`, from the first hold marker in the page to the last one gone – the frame's hold
 * (`[data-held]`, weather and music) or the pages' own row holds (`lists-reading`, `chat-reading`, which appear only
 * once the list or the chat setup is known); and `shown`, wall-clock time from `page.goto` until the page's main part
 * is there with no marker left (boot, code, reads and hold together; the seed fixture fixes the page clock, so this is
 * timed from the test). Plus the layout shift of the whole open. Three runs per page and device: the first visit (weather
 * without a cached forecast), a second load, and a slow one whose answers of the mocked services (open-meteo, Spotify)
 * arrive only after 1.5 s, on a 4× slower CPU (lists and chat read nothing over the network; the slow CPU is what slows
 * their reads). The lines go to the console and the test's annotations.
 *
 * Measurement only, not a CI gate (`open-shift*.seed.spec.ts` guard the CLS): it runs only with `MEASURE_HOLD=1`,
 * e.g. `MEASURE_HOLD=1 npx playwright test --project=seed-dev e2e/seed/open-hold.seed.spec.ts --workers=1`.
 */
const CLS_MAX = 0.05;
const SLOW_ANSWER_MS = 1500;
const MARKERS = '[data-held], [data-testid="lists-reading"], [data-testid="chat-reading"]';

interface Hold {
  from?: number;
  to?: number;
}

async function watch(page: Page) {
  await page.addInitScript((markers: string) => {
    const w = window as unknown as { __cls: number; __hold: Hold; __moved: string[] };
    w.__cls = 0;
    w.__moved = [];
    const hold: Hold = {};
    w.__hold = hold;
    let on = false;
    new MutationObserver(() => {
      const now = !!document.querySelector(markers);
      if (now && !on) {
        hold.from ??= performance.now();
        hold.to = undefined;
      }
      if (!now && on) hold.to = performance.now();
      on = now;
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-held', 'data-testid'],
    });
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
          sources?: { node: Node | null; previousRect: DOMRect; currentRect: DOMRect }[];
        }[]) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          // What moved in the larger shifts: element (test id), top before → after.
          if (e.value < 0.005) continue;
          const moved = (e.sources ?? []).map(({ node, previousRect, currentRect }) => {
            const el = node instanceof Element ? node : undefined;
            const id = el?.getAttribute('data-testid');
            const name = `${el?.tagName.toLowerCase() ?? '?'}${id ? `[${id}]` : ''}`;
            return `${name} ${Math.round(previousRect.y)}→${Math.round(currentRect.y)}`;
          });
          w.__moved.push(`${e.value.toFixed(3)}: ${moved.join(', ')}`);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      // no layout-shift entries in this browser: the value stays 0
    }
  }, MARKERS);
}

/** Waits until no marker is left and `main` has stopped changing, then reads hold and shift. */
async function measure(page: Page, label: string, shown: number) {
  await expect(page.locator(MARKERS)).toHaveCount(0, { timeout: 15_000 });
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
  const r = await page.evaluate(() => {
    const {
      __cls: cls,
      __hold: h,
      __moved: moved,
    } = window as unknown as { __cls: number; __hold: Hold; __moved: string[] };
    return {
      cls,
      moved,
      held: h.from === undefined ? 0 : h.to === undefined ? null : Math.round(h.to - h.from),
    };
  });
  const line = `held ${r.held ?? '–'} ms, shown after ${shown} ms, CLS ${r.cls.toFixed(4)}${r.moved.map((m) => `; moved ${m}`).join('')}`;
  console.log(`HOLD ${label}: ${line}`);
  test.info().annotations.push({ type: `hold ${label}`, description: line });
  return r;
}

/**
 * The answers of the hosts the page mocks come only after `SLOW_ANSWER_MS` (only those: a delayed route falls back to
 * the mock, never to a real host); CPU 4× slower (Chromium only).
 */
async function slowDown(page: Page, hosts: readonly string[]) {
  const late = (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
    new Promise<void>((done) =>
      setTimeout(() => void route.fallback().then(done, done), SLOW_ANSWER_MS),
    );
  for (const host of hosts) await page.route(host, late);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

const PAGES = {
  weather: {
    path: '/weather',
    async prepare(page: Page) {
      const { mockWeather, pickWeatherPlace } = await import('../weather-mock');
      await mockWeather(page);
      return async () => expect(await pickWeatherPlace(page), 'a place was picked').toBe(true);
    },
    ready: '[data-testid="weather-temp"]',
    hosts: ['**://api.open-meteo.com/**', '**://air-quality-api.open-meteo.com/**'],
    // The forecast is cached on the device for 30 minutes: without it the page waits for the network.
    fresh: (page: Page) =>
      page.evaluate(() =>
        ['tm-weather', 'tm-weather-tried'].forEach((k) => localStorage.removeItem(k)),
      ),
  },
  lists: {
    path: '/lists',
    prepare: async () => async () => {},
    ready: '[data-testid="lists-add"]',
    hosts: [],
  },
  chat: {
    path: '/chat',
    prepare: async () => async () => {},
    ready: 'main h1',
    hosts: [],
  },
  music: {
    path: '/music',
    async prepare(page: Page) {
      await mockSpotify(page);
      return () => seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
    },
    ready: '[data-testid="music-main"]',
    hosts: ['https://api.spotify.com/**', 'https://accounts.spotify.com/api/token'],
  },
} as const;

for (const [device, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  const phone = device === 'phone';
  test.describe(`hold time when a page opens – ${device}`, () => {
    test.skip(!process.env.MEASURE_HOLD, 'measurement only: MEASURE_HOLD=1');
    test.use({
      viewport,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
      seeded: { scale: 'medium', ...(phone ? {} : { desktop: true }), preview: true },
    });

    for (const [name, p] of Object.entries(PAGES)) {
      test(`${p.path}: first visit, second visit, slow answers`, async ({ page }) => {
        test.setTimeout(180_000);
        const after = await p.prepare(page);
        await watch(page);
        await startSeeded(page, { phone });
        await after();

        const runs = [];
        for (const run of [
          'first visit',
          'second visit',
          p.hosts.length ? 'slow (1.5 s, CPU 4×)' : 'slow (CPU 4×)',
        ]) {
          if (run.startsWith('slow')) await slowDown(page, p.hosts);
          if (run !== 'second visit' && 'fresh' in p) await p.fresh(page);
          const started = Date.now();
          await page.goto(p.path);
          await page.waitForFunction(
            ([ready, markers]) =>
              !!document.querySelector(ready) && !document.querySelector(markers),
            [p.ready, MARKERS] as const,
            { polling: 16, timeout: 15_000 },
          );
          const shown = Date.now() - started;
          runs.push(await measure(page, `${name} ${device}, ${run}`, shown));
        }
        expect(runs[0]!.cls, 'layout shift, first visit').toBeLessThanOrEqual(CLS_MAX);
        expect(runs[1]!.cls, 'layout shift, second visit').toBeLessThanOrEqual(CLS_MAX);
      });
    }
  });
}
