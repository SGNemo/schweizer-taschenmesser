import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Cold start on a throttled phone (manual tooling, `npm run measure:coldstart`; numbers in
 * docs/perf/COLD-START-2026-10.md). Chrome DevTools profile: CPU 4× slower, network "Fast 3G".
 *
 * Two scenarios, each RUNS times in a fresh browser context, median reported:
 * - `first visit`: nothing cached, everything comes over the throttled network.
 * - `installed`: the service worker has precached the app once; then a new page opens it again (the PWA
 *   started from the home screen). This is the "catch a thought" path the < 1.5 s target is about.
 *
 * Metrics (ms since navigation start, taken in the page by an init script, no polling delay):
 * first paint (the HTML splash), `main h1` visible (the app rendered), quick-capture field focused
 * (`/?capture=1`, the "Quick capture" shortcut of the installed app: the field takes keys).
 */
const RUNS = Number(process.env.COLDSTART_RUNS ?? 5);
const OUT = process.env.COLDSTART_OUT ?? 'test-results/coldstart';
const LABEL = process.env.COLDSTART_LABEL ?? 'run';
const URL = '/?capture=1';

/** Chrome DevTools "Fast 3G" (latency 562.5 ms, 1.44 Mbit/s down, 675 kbit/s up). */
const FAST_3G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
  uploadThroughput: (750 * 1024 * 0.9) / 8,
};

interface Sample {
  firstPaint: number;
  h1: number;
  captureFocused: number;
}

/** Records the moments in the page itself; read back with `window.__coldstart`. */
function probe() {
  const marks: Record<string, number> = {};
  (window as unknown as { __coldstart: Record<string, number> }).__coldstart = marks;
  const check = () => {
    const h1 = document.querySelector('main h1');
    if (!marks.h1 && h1 && (h1 as HTMLElement).offsetParent !== null) marks.h1 = performance.now();
    const el = document.activeElement as HTMLElement | null;
    if (!marks.captureFocused && el?.getAttribute('aria-label') === 'Was möchtest du festhalten?')
      marks.captureFocused = performance.now();
    if (!marks.h1 || !marks.captureFocused) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
  document.addEventListener('focusin', check, true);
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', FAST_3G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function measure(page: Page): Promise<Sample> {
  await page.addInitScript(probe);
  await throttle(page);
  await page.goto(URL, { waitUntil: 'commit' });
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __coldstart?: Record<string, number> }).__coldstart;
      return Boolean(m?.h1 && m.captureFocused);
    },
    undefined,
    { timeout: 120_000, polling: 100 },
  );
  return page.evaluate(() => {
    const m = (window as unknown as { __coldstart: Record<string, number> }).__coldstart;
    const fp = performance.getEntriesByType('paint').find((e) => e.name === 'first-paint');
    return {
      firstPaint: Math.round(fp?.startTime ?? 0),
      h1: Math.round(m.h1 ?? 0),
      captureFocused: Math.round(m.captureFocused ?? 0),
    };
  });
}

/** Opens the app once without throttling and waits until the service worker controls it (precache done). */
async function install(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker?.getRegistration();
      return Boolean(reg?.active && reg.active.state === 'activated');
    },
    undefined,
    { timeout: 120_000 },
  );
  await page.close();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

function summary(samples: Sample[]) {
  return {
    firstPaint: median(samples.map((s) => s.firstPaint)),
    h1: median(samples.map((s) => s.h1)),
    captureFocused: median(samples.map((s) => s.captureFocused)),
    runs: samples,
  };
}

test('cold start on a throttled phone (CPU 4×, Fast 3G)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'pixel-7', 'phone profile only');
  const { defaultBrowserType: _, ...phone } = devices['Pixel 7'];
  const device = { ...phone, locale: 'de-DE', baseURL: info.project.use.baseURL };
  const result: Record<string, ReturnType<typeof summary>> = {};

  const first: Sample[] = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ ...device, serviceWorkers: 'block' });
    first.push(await measure(await context.newPage()));
    await context.close();
  }
  result['first visit'] = summary(first);

  const installed: Sample[] = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ ...device, serviceWorkers: 'allow' });
    await install(context);
    installed.push(await measure(await context.newPage()));
    await context.close();
  }
  result.installed = summary(installed);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${LABEL}.json`, `${JSON.stringify(result, null, 1)}\n`);
  console.log(`\nCold start, pixel-7, CPU 4×, Fast 3G, median of ${RUNS} (ms)`);
  console.log('scenario       first paint   main h1   capture field');
  for (const [name, r] of Object.entries(result)) {
    console.log(
      `${name.padEnd(14)} ${String(r.firstPaint).padStart(11)} ${String(r.h1).padStart(9)} ${String(r.captureFocused).padStart(15)}`,
    );
  }
});
