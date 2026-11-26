import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { ready } from '../helpers';

/**
 * Performance pass of the weather scenes (manual tooling, not CI; handoff 04 "Performance pass", ceilings in
 * docs/design/weather-scenes@ca90c392f/A11Y.md §4, numbers in docs/perf/WEATHER-SCENES-2026-11.md).
 *
 * Runs on the e2e build (`npm run build:e2e && npm run preview`, :4173) on a desktop and a Pixel 7 profile with the
 * CPU slowed through CDP (`Emulation.setCPUThrottlingRate`, WS_RATE, default 4). The whole network is mocked like
 * e2e/screenshots/weather.spec.ts (invented place "Lindenau"), the clock starts at the scenario's instant, the browser runs in Europe/Berlin.
 * Run with `npm run measure:weather` (playwright.weather-perf.config.ts: the e2e build on :4173, desktop and Pixel 7).
 * Per scenario (the heaviest states the product can reach):
 * - `/weather` with a CDP trace: SVG elements and bytes of the head scene, animated groups, time from navigation to
 *   the scene's insertion and to the frame after it, main-thread time (merged `RunTask` on the renderer's main thread),
 *   long tasks, paints, timers and animation frames during the 5 s of motion and in a 5 s window 1 s after `data-motion`
 *   turned `rest`; the same window once more with reduced motion (the still picture) as the baseline;
 * - re-inserting the scene's markup (parse + style + layout, then the next frame), median of 7;
 * - layout shifts from load until rest, and the share whose sources lie in the scene;
 * - hidden page (`document.hidden` forced + `visibilitychange`) while the motion runs and after rest:
 *   `document.getAnimations()` by play state;
 * - the overview `/`: porthole and widget scene (elements, bytes), whether their chunk is fetched after the first
 *   contentful paint, layout shifts, main-thread time over 5 s at rest;
 * - with WS_LAB=1 (default): `sceneOf` + `sceneSvg` / `portholeSvg` timed in the page (CPU slowed), from a small
 *   bundle of `core/weather/scene` + `ui/weather-scene/draw` built with Vite into node_modules/.cache.
 * JSON per project and scenario in WS_OUT (default node_modules/.cache/weather-scene); WS_TRACE=1 adds the raw trace.
 */
const RATE = Number(process.env.WS_RATE ?? 4);
const OUT = process.env.WS_OUT ?? 'node_modules/.cache/weather-scene';
const LAB = process.env.WS_LAB !== '0';
const LAB_DIR = resolve('node_modules/.cache/weather-scene-lab');

interface Scenario {
  id: string;
  utc: string;
  local: string;
  code: number;
  temp: number;
  min: number;
  gust: number;
  cloud: number;
  kp: number;
  snowDepth: number;
  sunrise: string;
  sunset: string;
}
const BASE = { lat: 49.6, lon: 11.0, tz: 'Europe/Berlin' };
const SCENARIOS: Scenario[] = [
  {
    // Heavy snow showers at night, gusts 85 km/h (wind 3), −8 °C (hard frost), snow lying, the moon a day after full,
    // Kp 8 (aurora): the heaviest state of the enumeration (165 elements).
    id: 'snow-aurora-night',
    utc: '2026-11-25T21:00:00Z',
    local: '2026-11-25T22:00',
    code: 86,
    temp: -8,
    min: -10,
    gust: 85,
    cloud: 50,
    kp: 8,
    snowDepth: 0.2,
    sunrise: '07:40',
    sunset: '16:25',
  },
  {
    // Thunder with hail at night under the full moon, gusts 85 km/h, −6 °C.
    id: 'thunderhail-fullmoon',
    utc: '2026-11-24T01:50:00Z',
    local: '2026-11-24T02:50',
    code: 99,
    temp: -6,
    min: -7,
    gust: 85,
    cloud: 50,
    kp: 2,
    snowDepth: 0,
    sunrise: '07:38',
    sunset: '16:24',
  },
  {
    // The first scenario with little wind (gusts 25 km/h, wind 0): no swaying trees, to set the wind's share apart.
    id: 'snow-aurora-night-still-air',
    utc: '2026-11-25T21:00:00Z',
    local: '2026-11-25T22:00',
    code: 86,
    temp: -8,
    min: -10,
    gust: 25,
    cloud: 50,
    kp: 8,
    snowDepth: 0.2,
    sunrise: '07:40',
    sunset: '16:25',
  },
];

test.use({ timezoneId: BASE.tz, colorScheme: 'light', trace: 'off' });

async function mock(page: Page, s: Scenario) {
  // Anything not mocked below never reaches the network (the specific routes, registered later, win).
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  const d0 = Date.parse(`${s.local.slice(0, 10)}T12:00:00Z`);
  const dates = Array.from({ length: 7 }, (_, i) =>
    new Date(d0 + i * 864e5).toISOString().slice(0, 10),
  );
  const hours = dates
    .slice(0, 2)
    .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  await page.route('**://geocoding-api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        results: [
          { name: 'Lindenau', country: 'Deutschland', latitude: BASE.lat, longitude: BASE.lon },
        ],
      },
    }),
  );
  await page.route('**://air-quality-api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { european_aqi: 22, pm10: 14, pm2_5: 8, dust: 3 } } }),
  );
  await page.route('**://api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        timezone: BASE.tz,
        current: {
          time: s.local,
          temperature_2m: s.temp,
          weather_code: s.code,
          apparent_temperature: s.temp - 6,
          relative_humidity_2m: 90,
          wind_speed_10m: s.gust >= 70 ? 40 : 10,
          wind_gusts_10m: s.gust,
          is_day: 0,
          cloud_cover: s.cloud,
          pressure_msl: 990,
          wind_direction_10m: 250,
          snow_depth: s.snowDepth,
        },
        hourly: {
          time: hours,
          temperature_2m: hours.map(() => s.temp),
          weather_code: hours.map(() => s.code),
          precipitation_probability: hours.map(() => 80),
          cloud_cover: hours.map(() => s.cloud),
        },
        daily: {
          time: dates,
          weather_code: dates.map(() => s.code),
          temperature_2m_max: dates.map(() => s.temp + 3),
          temperature_2m_min: dates.map(() => s.min),
          precipitation_probability_max: dates.map(() => 80),
          wind_gusts_10m_max: dates.map(() => s.gust),
          uv_index_max: dates.map(() => 0),
          sunrise: dates.map((d) => `${d}T${s.sunrise}`),
          sunset: dates.map((d) => `${d}T${s.sunset}`),
        },
      },
    }),
  );
  await page.route('**://maps.dwd.de/**', (r) =>
    r.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: { type: 'FeatureCollection', features: [] },
    }),
  );
  await page.route('**://services.swpc.noaa.gov/**', (r) =>
    r.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: Array.from({ length: 24 }, (_, i) => ({
        time_tag: new Date(Date.parse(s.utc) - 24 * 3600e3 + i * 3 * 3600e3)
          .toISOString()
          .slice(0, 19),
        kp: s.kp,
        observed: 'predicted',
        noaa_scale: null,
      })),
    }),
  );
}

/** The page's clock starts at `utc` and runs at real speed; `performance` stays the browser's own. */
function shiftClock(utc: string) {
  const Real = Date;
  // `__wsOffset` can be moved forward by the spec (the "back after a long absence" replay).
  const g = globalThis as unknown as { __wsOffset: number };
  g.__wsOffset = Real.parse(utc) - Real.now();
  class Shifted extends Real {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(Real.now() + g.__wsOffset);
      else super(...(a as [number]));
    }
    static now() {
      return Real.now() + g.__wsOffset;
    }
  }
  globalThis.Date = Shifted as DateConstructor;
}

/** Layout shifts (with the share from the scene), and marks when the scene / porthole appears and comes to rest. */
function observe() {
  type Shift = { at: number; value: number; scene: boolean; sources: string[] };
  const w = window as unknown as {
    __ws: { cls: number; sceneCls: number; shifts: Shift[] };
  };
  w.__ws = { cls: 0, sceneCls: 0, shifts: [] };
  const SCENE = '[data-testid="sky"],[data-testid="scene-porthole"],[data-testid="weather-widget"]';
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        startTime: number;
        sources?: { node: Node | null; previousRect: DOMRect; currentRect: DOMRect }[];
      }[]) {
        if (e.hadRecentInput) continue;
        const els = (e.sources ?? []).map((x) =>
          x.node instanceof Element ? x.node : (x.node?.parentElement ?? null),
        );
        const scene = els.some((el) => !!el?.closest(SCENE));
        w.__ws.cls += e.value;
        if (scene) w.__ws.sceneCls += e.value;
        w.__ws.shifts.push({
          at: Math.round(e.startTime),
          value: Number(e.value.toFixed(4)),
          scene,
          sources: els.map(
            (el) =>
              `${el?.tagName.toLowerCase() ?? '?'}[${el?.getAttribute('data-testid') ?? ''}].${String(el?.className ?? '').split(' ')[0]}`,
          ),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // no layout-shift entries: the values stay 0
  }
  const marked = new Set<string>();
  const mark = (name: string) => {
    if (marked.has(name)) return;
    marked.add(name);
    performance.mark(name);
  };
  // Every time a head scene comes to rest: `ws-rest-1`, `ws-rest-2` … (fires only on `data-motion` changes).
  let rests = 0;
  const restMo = new MutationObserver((list) => {
    for (const r of list)
      if ((r.target as Element).getAttribute('data-motion') === 'rest') mark(`ws-rest-${++rests}`);
  });
  const check = () => {
    const head = document.querySelector('[data-testid="sky"] [data-testid="weather-scene"]');
    const hole = document.querySelector('[data-testid="scene-porthole"]');
    if (head && !marked.has('ws-scene-in')) {
      mark('ws-scene-in');
      requestAnimationFrame(() => setTimeout(() => mark('ws-scene-frame')));
    }
    if (hole && !marked.has('ws-porthole-in')) {
      mark('ws-porthole-in');
      requestAnimationFrame(() => setTimeout(() => mark('ws-porthole-frame')));
    }
    return !!head && !!hole;
  };
  const mo = new MutationObserver(() => {
    if (check()) mo.disconnect();
  });
  // Stop looking after 20 s so the rest window is free of this observer (a page shows only one of the two).
  const start = () => {
    restMo.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-motion'],
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20_000);
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);
}

interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  cat: string;
  args?: { name?: string };
}

async function traced<T>(
  cdp: CDPSession,
  run: () => Promise<T>,
): Promise<{ events: TraceEvent[]; result: T }> {
  const events: TraceEvent[] = [];
  // CDP types the trace events as `object`; they are the Chrome trace event format.
  const onData = (p: { value: object[] }) => events.push(...(p.value as TraceEvent[]));
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      includedCategories: [
        'toplevel',
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'blink.user_timing',
      ],
    },
  });
  const result = await run();
  const done = new Promise<void>((r) => cdp.once('Tracing.tracingComplete', () => r()));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return { events, result };
}

/** Main-thread busy time (merged top-level tasks), long tasks, paints, timers and frames in [from, to] (µs). */
function windowStats(events: TraceEvent[], from: number, to: number) {
  const main = events.find(
    (e) =>
      e.ph === 'M' &&
      e.name === 'thread_name' &&
      e.args?.name === 'CrRendererMain' &&
      events.some((m) => m.name.startsWith('ws-') && m.pid === e.pid && m.tid === e.tid),
  );
  if (!main) return undefined;
  const on = events.filter((e) => e.pid === main.pid && e.tid === main.tid);
  const tasks = on
    .filter(
      (e) => e.ph === 'X' && (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask'),
    )
    .map((e) => [Math.max(from, e.ts), Math.min(to, e.ts + (e.dur ?? 0))] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of tasks) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  const busy = merged.reduce((t, [a, b]) => t + b - a, 0);
  const long = merged.filter(([a, b]) => b - a >= 50_000).length;
  // The largest tasks: start after `from` and length, ms.
  const top = [...merged]
    .sort((x, y) => y[1] - y[0] - (x[1] - x[0]))
    .slice(0, 4)
    .map(([a, b]) => `${Math.round((a - from) / 1000)}+${Math.round((b - a) / 100) / 10}`);
  const n = (name: string) =>
    on.filter((e) => e.name === name && e.ts >= from && e.ts <= to).length;
  return {
    busyMs: Math.round(busy / 100) / 10,
    longTasks: long,
    tasks: merged.length,
    top,
    paints: n('Paint'),
    timers: n('TimerFire'),
    animationFrames: n('FireAnimationFrame'),
    styleRecalcs: n('UpdateLayoutTree'),
    layouts: n('Layout'),
  };
}

const markTs = (events: TraceEvent[], name: string) =>
  events.find((e) => e.name === name && e.cat.includes('blink.user_timing'))?.ts;

async function pickPlace(page: Page) {
  await ready(page, '/settings/verbindungen');
  await page.getByLabel('Ort suchen').fill('Lindenau');
  await page
    .locator('#weather--place')
    .getByRole('button', { name: 'Suchen', exact: true })
    .click();
  const notice = page.getByRole('button', { name: 'Verstanden' });
  const pick = page.getByRole('button', { name: /Lindenau.*wählen/ });
  await notice.or(pick).first().waitFor({ state: 'visible', timeout: 15_000 });
  if (await notice.isVisible()) {
    await notice.click();
    await page
      .locator('#weather--place')
      .getByRole('button', { name: 'Suchen', exact: true })
      .click();
  }
  await pick.click();
  await expect(page.getByTestId('weather-place')).toContainText('Lindenau');
}

/** Elements, bytes and animated groups of every scene SVG matching `sel`. */
const svgStats = (page: Page, sel: string) =>
  page.$$eval(sel, (els) =>
    els.map((svg) => ({
      elements: svg.querySelectorAll('*').length,
      bytes: svg.outerHTML.length,
      animated: svg.querySelectorAll('[class^="sc-"]').length,
      cond: svg.getAttribute('data-cond'),
      phase: svg.getAttribute('data-phase'),
      motion: svg.getAttribute('data-motion'),
    })),
  );

const marks = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      performance
        .getEntriesByType('mark')
        .filter((m) => m.name.startsWith('ws-'))
        .map((m) => [m.name, Math.round(m.startTime)]),
    ),
  );

async function animationStates(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const a of document.getAnimations()) out[a.playState] = (out[a.playState] ?? 0) + 1;
    return out;
  });
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function buildLab(): Promise<string> {
  const file = `${LAB_DIR}/lab.js`;
  if (existsSync(file)) return file;
  mkdirSync(LAB_DIR, { recursive: true });
  const entry = `${LAB_DIR}/entry.ts`;
  writeFileSync(
    entry,
    "export { sceneSvg, portholeSvg } from '@/ui/weather-scene/draw';\nexport { sceneOf } from '@/core/weather/scene';\n",
  );
  const { build } = await import('vite');
  await build({
    configFile: false,
    logLevel: 'warn',
    resolve: { alias: { '@': resolve('src') } },
    build: {
      outDir: LAB_DIR,
      emptyOutDir: false,
      copyPublicDir: false,
      lib: { entry, name: 'SceneLab', formats: ['iife'], fileName: () => 'lab.js' },
    },
  });
  return file;
}

for (const s of SCENARIOS)
  test(`weather scene perf: ${s.id}`, async ({ page }, info) => {
    const project = info.project.name;
    const result: Record<string, unknown> = { project, scenario: s.id, cpuRate: RATE };
    // Not `page.clock`: it fakes `performance` too (no marks, no resource entries, coarse `now()`).
    await page.addInitScript(shiftClock, s.utc);
    await mock(page, s);
    await page.addInitScript(observe);
    await pickPlace(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });

    // 1, 2, 4 – the head with motion, traced from navigation until 6.5 s after rest; then, on the settled page, the
    // motion once more (hidden, the clock 61 s on, shown again: `REPLAY_AFTER_MS`) and 6.5 s after that rest.
    const motion = await traced(cdp, async () => {
      await page.goto('/weather');
      await page
        .locator('[data-testid="weather-scene"][data-motion="rest"]')
        .waitFor({ timeout: 30_000 });
      await page.waitForTimeout(6500);
      await setHidden(page, true);
      await page.evaluate(() => {
        (globalThis as unknown as { __wsOffset: number }).__wsOffset += 61_000;
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => performance.mark('ws-replay'));
      await setHidden(page, false);
      await page
        .locator('[data-testid="weather-scene"][data-motion="run"]')
        .waitFor({ timeout: 10_000 });
      await page
        .locator('[data-testid="weather-scene"][data-motion="rest"]')
        .waitFor({ timeout: 30_000 });
      await page.waitForTimeout(6500);
    });
    // WS_TRACE=1: the raw trace (Chrome trace event format, opens in DevTools → Performance).
    if (process.env.WS_TRACE === '1') {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/${project}-${s.id}.trace.json`, JSON.stringify(motion.events));
    }
    const inAt = markTs(motion.events, 'ws-scene-in');
    const restAt = markTs(motion.events, 'ws-rest-1');
    const replayAt = markTs(motion.events, 'ws-replay');
    const rest2At = markTs(motion.events, 'ws-rest-2');
    result.head = (await svgStats(page, '[data-testid="sky"] [data-testid="weather-scene"]'))[0];
    result.headMarks = await marks(page);
    result.firstOpenWindow = inAt ? windowStats(motion.events, inAt, inAt + 5e6) : undefined;
    result.restWindow = restAt ? windowStats(motion.events, restAt + 1e6, restAt + 6e6) : undefined;
    result.replayMotionWindow = replayAt
      ? windowStats(motion.events, replayAt, replayAt + 5e6)
      : undefined;
    result.replaySteadyWindow = replayAt
      ? windowStats(motion.events, replayAt + 1e6, replayAt + 5e6)
      : undefined;
    result.replayRestWindow = rest2At
      ? windowStats(motion.events, rest2At + 1e6, rest2At + 6e6)
      : undefined;
    result.headCls = await page.evaluate(() => (window as unknown as { __ws: unknown }).__ws);

    // Render cost of the markup: parse + style + layout, then the next frame (CPU slowed), median of 7.
    result.reinsert = await page.evaluate(async () => {
      const svg = document.querySelector('[data-testid="sky"] [data-testid="weather-scene"]')!;
      const box = svg.getBoundingClientRect();
      const html = svg.outerHTML.replace(/data-motion="[^"]*"/, '');
      const sync: number[] = [];
      const frame: number[] = [];
      for (let i = 0; i < 7; i++) {
        const host = document.createElement('div');
        host.style.cssText = `position:fixed;left:0;top:0;width:${box.width}px;height:${box.height}px;opacity:0.01;pointer-events:none`;
        const t0 = performance.now();
        host.innerHTML = html;
        document.body.append(host);
        host.getBoundingClientRect();
        (host.firstElementChild as SVGGraphicsElement).getBBox();
        sync.push(performance.now() - t0);
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        frame.push(performance.now() - t0);
        host.remove();
        await new Promise((r) => setTimeout(r, 100));
      }
      const med = (a: number[]) => Math.round([...a].sort((x, y) => x - y)[3]! * 10) / 10;
      return { syncMs: med(sync), toFrameMs: med(frame) };
    });

    // 5 – hidden page: a new round, hidden after 1 s of motion, then shown again, then after rest.
    await page.goto('/weather');
    await page
      .locator('[data-testid="weather-scene"][data-motion="run"]')
      .waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    const runningBefore = await animationStates(page);
    await setHidden(page, true);
    await page.waitForTimeout(500);
    const hidden = {
      before: runningBefore,
      whileHidden: await animationStates(page),
      paused: await page.getAttribute('[data-testid="weather-scene"]', 'data-paused'),
    };
    await setHidden(page, false);
    await page.waitForTimeout(300);
    const shown = await animationStates(page);
    await page
      .locator('[data-testid="weather-scene"][data-motion="rest"]')
      .waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const afterRest = await animationStates(page);
    await setHidden(page, true);
    await page.waitForTimeout(300);
    result.hidden = {
      ...hidden,
      shownAgain: shown,
      afterRest,
      hiddenAfterRest: await animationStates(page),
    };
    await setHidden(page, false);

    // 2 – cross-check without tracing (its own overhead): CDP `Performance.getMetrics` over seconds 1–5 of a replayed
    // motion and over 4 s at rest.
    await cdp.send('Performance.enable');
    const metric = async () =>
      Object.fromEntries(
        (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
      );
    const delta = (a: Record<string, number>, b: Record<string, number>) => ({
      taskMs: Math.round((b.TaskDuration! - a.TaskDuration!) * 10000) / 10,
      scriptMs: Math.round((b.ScriptDuration! - a.ScriptDuration!) * 10000) / 10,
      layouts: b.LayoutCount! - a.LayoutCount!,
      styleRecalcs: b.RecalcStyleCount! - a.RecalcStyleCount!,
    });
    await page.waitForTimeout(2000);
    await setHidden(page, true);
    await page.evaluate(() => {
      (globalThis as unknown as { __wsOffset: number }).__wsOffset += 61_000;
    });
    await page.waitForTimeout(300);
    await setHidden(page, false);
    await page
      .locator('[data-testid="weather-scene"][data-motion="run"]')
      .waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    const r0 = await metric();
    await page.waitForTimeout(3900);
    const r1 = await metric();
    await page
      .locator('[data-testid="weather-scene"][data-motion="rest"]')
      .waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    const q0 = await metric();
    await page.waitForTimeout(4000);
    const q1 = await metric();
    result.metricsNoTrace = { motionSec1to5: delta(r0, r1), rest4s: delta(q0, q1) };

    // 2 – baseline: the same window with the still picture (reduced motion).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = await traced(cdp, async () => {
      await page.goto('/weather');
      await page
        .locator('[data-testid="sky"] [data-testid="weather-scene"]')
        .waitFor({ timeout: 30_000 });
      await page.waitForTimeout(11_500);
      // The same return after a long absence as above: without motion there is no new round, so this window is
      // what the page itself does on coming back (the baseline of `replayMotionWindow`).
      await setHidden(page, true);
      await page.evaluate(() => {
        (globalThis as unknown as { __wsOffset: number }).__wsOffset += 61_000;
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => performance.mark('ws-replay'));
      await setHidden(page, false);
      await page.waitForTimeout(6500);
    });
    const stillReplay = markTs(still.events, 'ws-replay');
    result.stillReplayWindow = stillReplay
      ? windowStats(still.events, stillReplay, stillReplay + 5e6)
      : undefined;
    result.stillReplaySteadyWindow = stillReplay
      ? windowStats(still.events, stillReplay + 1e6, stillReplay + 5e6)
      : undefined;
    const stillIn = markTs(still.events, 'ws-scene-in');
    result.stillMotionWindow = stillIn
      ? windowStats(still.events, stillIn, stillIn + 5e6)
      : undefined;
    result.stillRestWindow = stillIn
      ? windowStats(still.events, stillIn + 6e6, stillIn + 11e6)
      : undefined;
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // 1, 3, 4 – the overview: porthole + widget, lazy after the first paint, shifts, idle main thread.
    await page.goto('/');
    await page.getByTestId('scene-porthole').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(3000);
    const overviewNow = async () => ({
      portholes: await svgStats(page, '[data-testid="scene-porthole"] svg'),
      widgets: await page.getByTestId('weather-widget').count(),
      widgetScenes: await svgStats(
        page,
        '[data-testid="weather-widget"] [data-testid="weather-scene"]',
      ),
      marks: await marks(page),
      cls: await page.evaluate(() => (window as unknown as { __ws: unknown }).__ws),
      chunks: await page.evaluate(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
        const res = performance
          .getEntriesByType('resource')
          .filter((r) => /useSmallScene|WeatherGlance|WeatherWidget|useMoon|scene-/.test(r.name))
          .map((r) => ({
            file: r.name.replace(/^.*\/assets\//, ''),
            start: Math.round(r.startTime),
          }));
        return { fcp: Math.round(fcp), res };
      }),
    });
    const idle = async () => {
      await cdp.send('Performance.enable');
      const m0 = await cdp.send('Performance.getMetrics');
      await page.waitForTimeout(5000);
      const m1 = await cdp.send('Performance.getMetrics');
      const td = (m: typeof m0) => m.metrics.find((x) => x.name === 'TaskDuration')!.value;
      return Math.round((td(m1) - td(m0)) * 10000) / 10;
    };
    const calm = { ...(await overviewNow()), idleTaskMs5s: await idle() };
    // The widget is one of the cards behind "Ausführlich" on a fresh overview: switch, then open the overview anew.
    if (!calm.widgets) {
      await page.getByRole('button', { name: 'Ausführlich', exact: true }).click();
      await page.getByTestId('weather-widget').waitFor({ timeout: 30_000 });
      await page.goto('/');
      await page.getByTestId('weather-widget').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(3000);
    }
    result.overview = {
      calm,
      detailed: calm.widgets ? undefined : { ...(await overviewNow()), idleTaskMs5s: await idle() },
    };

    // 1 – the model and the drawing alone, timed in the page with the CPU slowed.
    if (LAB) {
      await page.addScriptTag({ path: await buildLab() });
      const lab = (sc: Scenario) =>
        page.evaluate((sc) => {
          const L = (
            window as unknown as {
              SceneLab: {
                sceneOf: (i: unknown) => unknown;
                sceneSvg: (s: unknown, o: unknown) => { inner: string };
                portholeSvg: (s: unknown, px: number, id: string) => unknown;
              };
            }
          ).SceneLab;
          const input = {
            forecast: {
              temp: sc.temp,
              group: 'snow',
              code: sc.code,
              time: sc.local,
              days: [{ date: sc.local.slice(0, 10), sunrise: sc.sunrise, sunset: sc.sunset }],
              now: {
                night: true,
                cloud: sc.cloud,
                wind: 40,
                gust: sc.gust,
                snowDepth: sc.snowDepth,
              },
            },
            at: Date.parse(sc.utc),
            nowMs: Date.parse(sc.utc),
            lat: 49.6,
            theme: 'light',
            motion: true,
            moon: { lit: 0.98, tilt: 12, alt: 35, az: 130, full: true, superMoon: false },
            event: sc.kp >= 7 ? { event: 'aurora', amount: 1 } : undefined,
          };
          const time = (f: () => void, n: number) => {
            for (let i = 0; i < 20; i++) f();
            const t: number[] = [];
            for (let i = 0; i < n; i++) {
              const a = performance.now();
              f();
              t.push(performance.now() - a);
            }
            t.sort((x, y) => x - y);
            return {
              median: Math.round(t[n >> 1]! * 1000) / 1000,
              p95: Math.round(t[Math.floor(n * 0.95)]! * 1000) / 1000,
            };
          };
          const state = L.sceneOf(input);
          const cold = performance.now();
          L.sceneSvg(state, { idPrefix: 'lab' });
          const first = performance.now() - cold;
          return {
            firstSceneSvgMs: Math.round(first * 1000) / 1000,
            sceneOf: time(() => L.sceneOf(input), 200),
            sceneSvg: time(() => L.sceneSvg(state, { idPrefix: 'lab' }), 200),
            sceneOfPlusSvg: time(() => L.sceneSvg(L.sceneOf(input), { idPrefix: 'lab' }), 200),
            porthole64: time(() => L.portholeSvg(state, 64, 'pt'), 200),
            elements: (L.sceneSvg(state, { idPrefix: 'lab' }).inner.match(/<[a-zA-Z]/g) ?? [])
              .length,
          };
        }, sc);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const unthrottled = await lab(s);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
      result.lab = { rate1: unthrottled, [`rate${RATE}`]: await lab(s) };
    }

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${project}-${s.id}.json`, JSON.stringify(result, null, 2));
    console.log(`${project} ${s.id}\n${JSON.stringify(result, null, 1)}`);
  });
