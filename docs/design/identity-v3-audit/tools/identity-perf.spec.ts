import { writeFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';

/**
 * Audit tooling (docs/design/identity-v3-audit): a performance sample of the identity surfaces. Per page: CDP
 * performance metrics after load (style recalc, layout, paint-related task time), the number of elements with a
 * pattern/gradient/mask, running animations, and frame times while scrolling. Each page twice: module colours on
 * (patterns + tints) and the calm colour mode (patterns off), so the cost of the decoration is visible.
 * Usage (web/, seeded preview on :4174): SCREENS_DIR=<dir> npx playwright test -c playwright.audit.config.ts identity-perf
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/identity-audit';
const PAGES = [
  { name: 'dashboard-calm-view', path: '/' },
  { name: 'dashboard-all', path: '/', all: true },
  { name: 'finance', path: '/finance?tab=overview' },
  { name: 'calendar-week', path: `/calendar?view=week&date=${SEED_TODAY}` },
  { name: 'music', path: '/music' },
  { name: 'library', path: '/library' },
  { name: 'settings', path: '/settings' },
];

async function enableModules(page: Page, ids: string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({ id, enabled: true, dataPolicy: null, createdAt: 1, updatedAt: 1, deviceId: 'screens', deletedAt: null, _f: {} });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

interface Sample {
  page: string;
  mode: string;
  nodes: number;
  decorated: { gradients: number; masks: number; shadows: number; patterns: number; blurs: number };
  animations: number;
  metrics: Record<string, number>;
  scroll: { frames: number; slow32: number; slow50: number; maxMs: number; avgMs: number };
}

test('identity perf sample', async ({ browser }) => {
  test.setTimeout(0);
  const samples: Sample[] = [];
  for (const mode of ['colour', 'calm']) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await mockWeather(page);
    await page.addInitScript((calm) => {
      localStorage.setItem('tm-show-preview', '1');
      localStorage.setItem('__tmPlatformKind', 'desktop');
      if (calm) localStorage.setItem('tm-color', 'calm');
    }, mode === 'calm');
    await bootDev(page);
    await seedApp(page, 'medium');
    await enableModules(page, ['chat', 'maps', 'music', 'disk', 'mail', 'browser', 'downloads']);
    await pickWeatherPlace(page);
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    for (const p of PAGES) {
      await page.evaluate((all) => {
        if (all) localStorage.setItem('tm-home-view', 'all');
        else localStorage.removeItem('tm-home-view');
      }, !!p.all);
      // Fresh document per page so the metrics are per page, not cumulative.
      await page.goto('about:blank');
      const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
      await page.goto(p.path);
      await page.locator('main').waitFor();
      await page.waitForTimeout(2500);
      const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
      const metrics: Record<string, number> = {};
      for (const k of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount', 'Nodes', 'JSHeapUsedSize'])
        metrics[k] = Math.round(((after[k] ?? 0) - (k === 'Nodes' || k === 'JSHeapUsedSize' ? 0 : (before[k] ?? 0))) * (k.endsWith('Duration') ? 1000 : 1));
      const stats = await page.evaluate(() => {
        const all = [...document.querySelectorAll<HTMLElement>('body *')];
        let gradients = 0, masks = 0, shadows = 0, patterns = 0, blurs = 0;
        for (const el of all) {
          const cs = getComputedStyle(el);
          const bg = cs.backgroundImage;
          if (bg && bg !== 'none') { gradients += 1; if (bg.includes('repeating') || /gradient\(.*1px/.test(bg)) patterns += 1; }
          const mask = (cs as unknown as { maskImage?: string; webkitMaskImage?: string }).maskImage ?? (cs as unknown as { webkitMaskImage?: string }).webkitMaskImage;
          if (mask && mask !== 'none') masks += 1;
          if (cs.boxShadow && cs.boxShadow !== 'none') shadows += 1;
          if ((cs as unknown as { backdropFilter?: string }).backdropFilter && (cs as unknown as { backdropFilter?: string }).backdropFilter !== 'none') blurs += 1;
          // pseudo-elements carry the area pattern
          for (const pseudo of ['::before', '::after']) {
            const ps = getComputedStyle(el, pseudo);
            if (ps.content !== 'none' && ps.backgroundImage && ps.backgroundImage !== 'none') { gradients += 1; if (ps.backgroundImage.includes('gradient')) patterns += 1; }
          }
        }
        return { nodes: all.length, decorated: { gradients, masks, shadows, patterns, blurs }, animations: document.getAnimations().length };
      });
      // Scroll test: 40 frames of programmatic scrolling in #main, frame deltas via rAF.
      const scroll = await page.evaluate(async () => {
        const main = document.getElementById('main') ?? document.scrollingElement!;
        const deltas: number[] = [];
        let last = performance.now();
        await new Promise<void>((resolve) => {
          let i = 0;
          const step = () => {
            const now = performance.now();
            deltas.push(now - last);
            last = now;
            main.scrollTop += 60;
            if (++i < 60) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
        const d = deltas.slice(1);
        return { frames: d.length, slow32: d.filter((x) => x > 32).length, slow50: d.filter((x) => x > 50).length, maxMs: Math.round(Math.max(...d)), avgMs: Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 };
      });
      samples.push({ page: p.name, mode, ...stats, metrics, scroll });
    }
    await context.close();
  }
  writeFileSync(`${OUT}/perf-sample.json`, JSON.stringify(samples, null, 2));
  const rows = samples.map((s) => `${s.page.padEnd(20)} ${s.mode.padEnd(7)} nodes ${String(s.nodes).padStart(5)} grad ${String(s.decorated.gradients).padStart(4)} pattern ${String(s.decorated.patterns).padStart(3)} mask ${String(s.decorated.masks).padStart(3)} shadow ${String(s.decorated.shadows).padStart(4)} anim ${String(s.animations).padStart(2)} | task ${String(s.metrics.TaskDuration).padStart(5)} ms script ${String(s.metrics.ScriptDuration).padStart(5)} layout ${String(s.metrics.LayoutDuration).padStart(4)} style ${String(s.metrics.RecalcStyleDuration).padStart(4)} (layouts ${s.metrics.LayoutCount}, recalcs ${s.metrics.RecalcStyleCount}) | scroll avg ${s.scroll.avgMs} ms max ${s.scroll.maxMs} slow>32: ${s.scroll.slow32}`);
  writeFileSync(`${OUT}/perf-sample.txt`, rows.join('\n') + '\n');
  console.log(rows.join('\n'));
});
