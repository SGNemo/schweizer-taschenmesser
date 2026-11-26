/**
 * Measures the round-2 scene: size, cost and contrast under the text. Prints a markdown report and writes it to
 * web/.screens/weather-scenes-2/measure.md (gitignored). Run from any directory:
 *   node docs/design/weather-scenes-2/mockups/measure.mjs        (RUNS=15 by default; RUNS=3 for a quick look)
 * Cost: per state, element count (svg.querySelectorAll('*')), markup KB, and the time from "start drawing" (Scene.svg +
 * insert) to the first paint after it (rAF → setTimeout), at 1650 × 320 and at 412 × 256 (phone crop), 4× CPU throttle,
 * median of RUNS.
 * Contrast: per sky key × theme, the scene is screenshotted at 1650 × 320 and 412 × 256 and the pixels where text stands
 * on it are sampled (desktop: x 24–700, y 60–256; phone: x 16–290, y 96–156). WCAG contrast of the ink (Scene.ink:
 * light #eceff1, dark #171f24) against the worst pixel and against the 5th-percentile pixel; every case under 4.5:1 is
 * listed with the place of the worst pixel.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '../../../../web/.screens/weather-scenes-2');
mkdirSync(outDir, { recursive: true });
const RUNS = +(process.env.RUNS || 15);

// one state per sky key, then the heaviest cases; each in both themes
const KEYS = [
  ['day', { cond: 'clear' }], ['heat', { cond: 'clear', heat: true }], ['golden', { phase: 'golden', body: { kind: 'sun', t: 0.9 } }],
  ['dawn', { phase: 'dawn', cond: 'clear' }], ['dusk', { phase: 'dusk', cond: 'clear' }], ['overcast', { cond: 'overcast' }],
  ['drizzle', { cond: 'drizzle' }], ['rain', { cond: 'rain', intensity: 2 }], ['storm', { cond: 'thunder', thunder: 2 }],
  ['snow', { cond: 'snow', intensity: 2, snowCover: 2, season: 'winter' }], ['fog', { cond: 'fog', fog: 1 }], ['dust', { cond: 'clear', event: 'dust' }],
  ['eclipse-sky', { cond: 'clear', event: 'solarTotal', body: { kind: 'sun', t: 0.5 } }],
  ['night', { phase: 'night', cond: 'clear', moon: { illum: 0.5, waxing: true } }], ['night-full', { phase: 'night', cond: 'clear', moon: { illum: 1 } }],
  ['night-overcast', { phase: 'night', cond: 'overcast' }], ['night-rain', { phase: 'night', cond: 'rain', intensity: 2 }],
  ['night-snow', { phase: 'night', cond: 'snow', intensity: 2, snowCover: 2, season: 'winter' }], ['night-fog', { phase: 'night', cond: 'fog', fog: 1 }],
];
const HEAVY = [
  ['storm 3 + wind 3', { cond: 'thunderHail', thunder: 3, intensity: 3, wind: 3 }], ['snow 3 + wind 3', { cond: 'snow', intensity: 3, snowCover: 3, season: 'winter', wind: 3 }],
  ['overcast night, banks', { phase: 'night', cond: 'overcast', moon: { illum: 0.8 } }], ['broken cover (3)', { cond: 'partly', cover: 3, wind: 1 }],
  ['overcast day, banks', { cond: 'overcast' }], ['rain 3 + fog 2', { cond: 'rain', intensity: 3, fog: 2, wind: 2 }],
];
const LIST = [];
for (const [name, st] of [...KEYS, ...HEAVY]) for (const theme of ['light', 'dark']) LIST.push({ name, theme, state: { ...st, theme } });

const page0 = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#888}#b{position:relative;overflow:hidden}#b>svg{position:absolute;inset:0;display:block}</style>
${['palette', 'scene', 'events'].map((f) => `<script src="${pathToFileURL(path.join(here, f + '.js')).href}"></script>`).join('')}</head><body><div id="b"></div></body></html>`;
const pagePath = path.join(outDir, 'measure-page.html'); // outside the repo's tracked files
writeFileSync(pagePath, page0);

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(pathToFileURL(pagePath).href);
const SIZES = { wide: [1650, 320], phone: [412, 256] };

// ---- cost ----
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const cost = [];
for (const it of LIST) {
  const row = { ...it };
  for (const [kind, [w, h]] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: w, height: h });
    const r = await page.evaluate(async ({ st, kind, w, h, runs }) => {
      const b = document.getElementById('b'); b.style.width = w + 'px'; b.style.height = h + 'px';
      const times = []; let markup = '';
      for (let i = 0; i < runs + 1; i++) {
        b.innerHTML = ''; await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        const t0 = performance.now();
        markup = Scene.svg(st, kind === 'phone' ? Object.assign(Scene.phoneOpts(256, 412), { idp: 'm' + i }) : { idp: 'm' + i });
        b.innerHTML = markup;
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        if (i) times.push(performance.now() - t0); // the first run warms up
      }
      times.sort((a, c) => a - c);
      return { els: b.querySelector('svg').querySelectorAll('*').length, kb: markup.length / 1024, ms: times[Math.floor(times.length / 2)] };
    }, { st: it.state, kind, w, h, runs: RUNS });
    row[kind] = r;
  }
  cost.push(row);
  process.stdout.write('.');
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log('');

// ---- contrast ----
const RECT = { wide: [24, 60, 700, 256], phone: [16, 96, 290, 156] }; // the rows text really stands on
const INK = { light: '#eceff1', dark: '#171f24' };
function lum(r, g, b) { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function hexLum(h) { return lum(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)); }
function ratio(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
const contrast = [];
for (const it of LIST.filter((x) => KEYS.some((k) => k[0] === x.name) || x.name === 'storm 3 + wind 3' || x.name === 'snow 3 + wind 3' || x.name === 'broken cover (3)')) {
  const ink = await page.evaluate((st) => Scene.ink(st), it.state);
  const L = hexLum(INK[ink]);
  const row = { name: it.name, theme: it.theme, ink };
  for (const [kind, [w, h]] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(({ st, kind, w, h }) => {
      const b = document.getElementById('b'); b.style.width = w + 'px'; b.style.height = h + 'px';
      b.innerHTML = Scene.svg(st, kind === 'phone' ? Scene.phoneOpts(256, 412) : {});
    }, { st: it.state, kind, w, h });
    const png = (await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } })).toString('base64');
    const [x0, y0, x1, y1] = RECT[kind];
    const px = await page.evaluate(async ({ png, x0, y0, x1, y1 }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return Array.from(g.getImageData(x0, y0, x1 - x0, y1 - y0).data);
    }, { png, x0, y0, x1, y1 });
    const n = px.length / 4, cr = new Float64Array(n); let worst = Infinity, wi = 0;
    for (let i = 0; i < n; i++) { const v = ratio(L, lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])); cr[i] = v; if (v < worst) { worst = v; wi = i; } }
    const sorted = Array.from(cr).sort((a, b) => a - b);
    row[kind] = { worst, p5: sorted[Math.floor(n * 0.05)], at: [x0 + (wi % (x1 - x0)), y0 + Math.floor(wi / (x1 - x0))] };
  }
  contrast.push(row);
  process.stdout.write('c');
}
console.log('');
await browser.close();

// ---- report ----
const r1 = (v) => v.toFixed(1), r2 = (v) => v.toFixed(2);
let md = `# Weather round 2 – scene measurement\n\n${new Date().toISOString().slice(0, 10)} · Chromium (playwright), 4× CPU throttle, median of ${RUNS} · paint = Scene.svg + insert → first paint\n\n`;
md += '## Cost\n\n| State | Theme | Elements wide / phone | KB wide / phone | Paint ms wide | Paint ms phone |\n| --- | --- | --- | --- | --- | --- |\n';
for (const c of cost) md += `| ${c.name} | ${c.theme} | ${c.wide.els} / ${c.phone.els} | ${r1(c.wide.kb)} / ${r1(c.phone.kb)} | ${r1(c.wide.ms)} | ${r1(c.phone.ms)} |\n`;
const max = (f) => Math.max(...cost.map(f));
md += `\n**Max:** ${max((c) => c.wide.els)} elements, ${r1(max((c) => c.wide.kb))} KB, paint ${r1(max((c) => c.wide.ms))} ms wide / ${r1(max((c) => c.phone.ms))} ms phone.\n\n`;
md += '## Contrast of the ink on the scene (text area)\n\nDesktop rect x 24–700, y 60–256 px of 1650 × 320; phone rect x 16–290, y 96–156 px of 412 × 256.\n\n';
md += '| Sky | Theme | Ink | Desktop worst | Desktop 5 % | Phone worst | Phone 5 % |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const c of contrast) md += `| ${c.name} | ${c.theme} | ${c.ink} | ${r2(c.wide.worst)} | ${r2(c.wide.p5)} | ${r2(c.phone.worst)} | ${r2(c.phone.p5)} |\n`;
md += '\n### Under 4.5 : 1\n\n';
const fails = [];
for (const c of contrast) for (const k of ['wide', 'phone']) {
  if (c[k].worst < 4.5) fails.push(`- ${c.name} · ${c.theme} · ${k === 'wide' ? 'desktop' : 'phone'}: worst ${r2(c[k].worst)} at (${c[k].at.join(', ')}) px, 5 % ${r2(c[k].p5)}${c[k].p5 < 4.5 ? ' **(5 % also under)**' : ''}`);
}
md += (fails.length ? fails.join('\n') : 'none') + '\n';
writeFileSync(path.join(outDir, 'measure.md'), md);
console.log(md);
