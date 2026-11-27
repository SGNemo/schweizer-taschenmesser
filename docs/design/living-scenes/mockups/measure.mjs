/**
 * Measures the living-scenes mockups. Writes web/.screens/living-scenes/measure.json and measure.md (gitignored) and
 * prints the markdown. Run from any directory:  node docs/design/living-scenes/mockups/measure.mjs   (RUNS=5 default)
 *  1. Pictures: element count (Living.count / Scene.count) and markup KB per garden state × form, clock tile, weather card.
 *  2. First contentful paint (pictures are drawn before it, synchronously) at 4× CPU throttle, median of RUNS, per page;
 *     the overview with ?bilder=aus and ?bilder=verspielt.
 *  3. WCAG contrast of the card inks on the toned card surface, six areas × T6/T12 × light/dark, and of each sign's main
 *     tone (and second tone, for information) on it. Colours resolved in the page (getComputedStyle → canvas → sRGB).
 *  4. Stimulus: the app's own `measurePage` (web/scripts/lib/stimulusBudget.ts, transpiled at run time, unchanged) on
 *     the overview's first viewport per variant, once as is and once with colours resolved through a canvas (the app's
 *     `parse` reads no oklab(), which the tone's color-mix serialises to); svg counts; share of the viewport in pictures.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '../../../../web');
const outDir = path.join(web, '.screens/living-scenes');
mkdirSync(outDir, { recursive: true });
const RUNS = +(process.env.RUNS || 5);
const ts = createRequire(path.join(web, 'package.json'))('typescript');
const src = readFileSync(path.join(web, 'scripts/lib/stimulusBudget.ts'), 'utf8');
const fn = src.slice(src.indexOf('export function measurePage()'), src.indexOf('/** The metric values a row gets'));
const measurePageJs = ts.transpile(fn.replace("export ", ""), { target: ts.ScriptTarget.ES2020 }).replace(/^"use strict";/, "").trim();
const url = (f, q = '') => pathToFileURL(path.join(here, f)).href + q;

const browser = await chromium.launch();
const result = { date: new Date().toISOString().slice(0, 10), pictures: [], paint: [], contrast: [], signs: [], stimulus: [] };

// ---- 1. pictures ----
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url('p2-habits.html'));
  result.pictures.push(...(await page.$$eval('.cell', (cells) => cells.filter((c) => c.querySelector('.card .pic') && c.closest('.gal') && !c.querySelector('.calm')).slice(0, 12)
    .map((c) => { const p = c.querySelector('.pic'); return { what: 'garden · ' + c.querySelector('.label').childNodes[0].textContent, px: p.clientWidth + '×' + p.clientHeight, els: +p.dataset.els, kb: +p.dataset.kb }; }))));
  await page.goto(url('p2-clock.html'));
  result.pictures.push(...(await page.$$eval('.skyPanel', (ps) => ps.slice(0, 1).map((p) => ({ what: 'clock tile (19:00, golden)', px: p.clientWidth + '×' + p.clientHeight, els: +p.dataset.els, kb: +p.dataset.kb })))));
  result.pictures.push(...(await page.$$eval('.skyRow', (ps) => ps.slice(0, 1).map((p) => ({ what: 'clock page row sky', px: p.clientWidth + '×' + p.clientHeight, els: +p.dataset.els, kb: +p.dataset.kb })))));
  await page.goto(url('p2-overview.html'));
  result.pictures.push(...(await page.$$eval('.pic, .skyPanel', (ps) => ps.map((p) => ({ what: 'overview · ' + p.closest('.card').dataset.card + (p.classList.contains('skyPanel') ? ' tile' : ''), px: p.clientWidth + '×' + p.clientHeight, els: +p.dataset.els, kb: +p.dataset.kb })))));
  await page.close();
}
// ---- 2. first paint, 4× CPU ----
for (const [name, f, q] of [['overview · bilder=aus', 'p2-overview.html', '?bilder=aus'], ['overview · verspielt T6', 'p2-overview.html', '?tone=6'], ['habits gallery', 'p2-habits.html', ''], ['clock gallery', 'p2-clock.html', ''], ['finance gallery', 'p2-finance.html', '']])
  for (const [w, h] of [[1920, 1080], [412, 915]]) {
    const times = [];
    for (let i = 0; i < RUNS + 1; i++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(url(f, q), { waitUntil: 'load' });
      const fcp = await page.evaluate(() => new Promise((r) => { const e = performance.getEntriesByName('first-contentful-paint')[0]; if (e) r(e.startTime); else new PerformanceObserver((l) => r(l.getEntries()[0].startTime)).observe({ type: 'paint', buffered: true }); }));
      if (i) times.push(fcp);
      await ctx.close();
    }
    times.sort((a, b) => a - b);
    result.paint.push({ name, vp: w + '×' + h, fcp: times[Math.floor(times.length / 2)] });
  }
// ---- 3. contrast ----
const AREAS = ['plan', 'money', 'household', 'knowledge', 'vault', 'system'];
const SIGNS = [['Wochenlast', 'indigo', 'plan'], ['Offene ToDos', 'moss', 'plan'], ['Heute geschafft (Ruhig)', 'violet', 'plan'], ['Zeiterfassung', 'teal', 'plan'], ['Budgets', 'lime', 'money'],
  ['Einkauf', 'orchid', 'household'], ['Heute dran', 'cobalt', 'household'], ['Vorräte', 'fern', 'household']];
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: scheme });
  await page.goto(url('p2-finance.html'));
  const r = await page.evaluate(({ AREAS, SIGNS }) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const cr = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
    const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
    const probe = (area, tone, hue) => {
      const el = document.createElement('section'); el.className = 'card'; el.dataset.area = area; if (hue) el.dataset.hue = hue; el.style.setProperty('--tone', tone + '%');
      el.innerHTML = '<span class="sign"><svg><rect class="s2"/></svg></span>'; document.body.appendChild(el);
      const cs = getComputedStyle(el), bg = rgb(cs.backgroundColor), vals = {};
      for (const n of ['--text', '--text-muted', '--text-3', '--accent', '--danger', '--module-color']) vals[n] = rgb(cs.getPropertyValue(n).trim());
      const s2 = rgb(getComputedStyle(el.querySelector('.s2')).fill);
      el.remove(); return { bg, v: (n) => vals[n], s2 };
    };
    const rows = [], signs = [];
    for (const area of AREAS) for (const tone of [0, 6, 12]) {
      const p = probe(area, tone);
      const inks = { text: p.v('--text'), muted: p.v('--text-muted'), meta: p.v('--text-3'), accent: p.v('--accent'), danger: p.v('--danger') };
      const row = { area, tone, bg: hex(p.bg) };
      for (const k in inks) row[k] = +cr(inks[k], p.bg).toFixed(2);
      rows.push(row);
    }
    for (const [name, hue, area] of SIGNS) for (const tone of [0, 6, 12]) {
      const p = probe(area, tone, hue);
      signs.push({ name, hue, area, tone, main: +cr(p.v('--module-color'), p.bg).toFixed(2), second: +cr(p.s2, p.bg).toFixed(2), mainVsSecond: +cr(p.v('--module-color'), p.s2).toFixed(2) });
    }
    return { rows, signs };
  }, { AREAS, SIGNS });
  r.rows.forEach((x) => result.contrast.push({ scheme, ...x }));
  r.signs.forEach((x) => result.signs.push({ scheme, ...x }));
  await page.close();
}
// ---- 4. stimulus ----
for (const [w, h] of [[1920, 1080], [412, 915]])
  for (const [variant, q] of [['aus', '?bilder=aus'], ['T6 verspielt', '?tone=6'], ['T12 verspielt', '?tone=12'], ['T6 ruhig', '?tone=6&bilder=ruhig']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url('p2-overview.html', q));
    const app = await page.evaluate(`(${measurePageJs})()`);
    const extra = await page.evaluate(() => {
      const vpA = innerWidth * innerHeight; let pic = 0;
      document.querySelectorAll('.pic, .skyPanel').forEach((el) => { const r = el.getBoundingClientRect(); const x = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), y = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); pic += x * y; });
      const signsAbove = Array.from(document.querySelectorAll('.sign')).filter((s) => s.getBoundingClientRect().top < innerHeight).length;
      return { svgRoots: document.querySelectorAll('svg').length, svgElements: document.querySelectorAll('svg, svg *').length, picShare: pic / vpA, signsAbove };
    });
    // the same function with every colour resolved to rgb() first (canvas), so the toned card surfaces become readable to `parse`
    const resolved = await page.evaluate(`(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
      const res = (c) => { if (!c || /^rgba?\\(/.test(c) || c === 'transparent') return c; g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return d[3] < 255 ? 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + (d[3] / 255).toFixed(2) + ')' : 'rgb(' + d[0] + ', ' + d[1] + ', ' + d[2] + ')'; };
      const orig = window.getComputedStyle;
      window.getComputedStyle = (el, p) => { const s = orig(el, p); return new Proxy(s, { get(t, k) { const v = Reflect.get(t, k); if (k === 'color' || k === 'backgroundColor' || k === 'borderTopColor') return res(v); if (k === 'getPropertyValue') return (n) => t.getPropertyValue(n); return typeof v === 'function' ? v.bind(t) : v; } }); };
      try { return (${measurePageJs})(); } finally { window.getComputedStyle = orig; }
    })()`);
    result.stimulus.push({ vp: w + '×' + h, variant, ...extra, colouredText: app.colouredText, colouredSurfaces: app.colouredSurfaces, colouredAboveFold: app.colouredText + app.colouredSurfaces,
      resolvedText: resolved.colouredText, resolvedSurfaces: resolved.colouredSurfaces, resolvedAboveFold: resolved.colouredText + resolved.colouredSurfaces, borders: app.borders, shadows: app.shadows });
    await page.close();
  }
await browser.close();

// ---- report ----
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), flag = (v, min) => (v < min ? `**${f2(v)}**` : f2(v));
let md = `# Living scenes – mockup measurement\n\n${result.date} · Chromium (playwright) · paint: 4× CPU, median of ${RUNS}\n\n`;
md += '## 1. Pictures\n\nCeilings (weather-scenes-2/A11Y.md §4): **≤ 220 elements** in the scene SVG, markup **≤ 64 KB** (round 2), first paint within one frame (phone profile, 4× CPU).\n\n| Picture | Box px | Elements | KB |\n| --- | --- | --- | --- |\n';
for (const p of result.pictures) md += `| ${p.what} | ${p.px} | ${p.els} | ${f1(p.kb)} |\n`;
md += '\n## 2. First contentful paint (4× CPU)\n\n| Page | Viewport | FCP ms |\n| --- | --- | --- |\n';
for (const p of result.paint) md += `| ${p.name} | ${p.vp} | ${f1(p.fcp)} |\n`;
md += '\n## 3. Contrast on the toned card surface (WCAG; bold = under 4.5:1)\n\nInks: text = --text (also link text), muted = --text-muted, meta = --text-3, accent = --accent as text, danger = --danger (the red overdue text).\n\n| Scheme | Area | Tone | Surface | text | muted | meta | accent | danger |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const c of result.contrast) md += `| ${c.scheme} | ${c.area} | T${c.tone} | ${c.bg} | ${flag(c.text, 4.5)} | ${flag(c.muted, 4.5)} | ${flag(c.meta, 4.5)} | ${flag(c.accent, 4.5)} | ${flag(c.danger, 4.5)} |\n`;
md += '\n### Signs: main tone (module hue) on the toned surface, ≥ 3:1 (bold = under); second tone (the hue 58 % into the surface) and main against second for information\n\n| Scheme | Sign | Hue / area | T0 main | T6 main | T12 main | T6 second | T6 main vs second |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const scheme of ['light', 'dark']) for (const n of [...new Set(result.signs.map((s) => s.name))]) {
  const s = (t) => result.signs.find((x) => x.scheme === scheme && x.name === n && x.tone === t);
  md += `| ${scheme} | ${n} | ${s(0).hue} / ${s(0).area} | ${flag(s(0).main, 3)} | ${flag(s(6).main, 3)} | ${flag(s(12).main, 3)} | ${f2(s(6).second)} | ${f2(s(6).mainVsSecond)} |\n`;
}
md += '\n## 4. Stimulus (first viewport of the overview, light)\n\n`app` = the app\'s measurePage as is; `resolved` = the same function with colours resolved to rgb first. Δ against `aus`.\n\n| Viewport | Variant | svg roots | svg elements | coloured above fold (app) | coloured above fold (resolved: text + surfaces) | Δ resolved | signs above fold | picture share of viewport |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const s of result.stimulus) {
  const base = result.stimulus.find((x) => x.vp === s.vp && x.variant === 'aus');
  md += `| ${s.vp} | ${s.variant} | ${s.svgRoots} (${s.svgRoots - base.svgRoots >= 0 ? '+' : ''}${s.svgRoots - base.svgRoots}) | ${s.svgElements} (+${s.svgElements - base.svgElements}) | ${s.colouredAboveFold} (${s.colouredAboveFold - base.colouredAboveFold >= 0 ? '+' : ''}${s.colouredAboveFold - base.colouredAboveFold}) | ${s.resolvedAboveFold} (${s.resolvedText} + ${s.resolvedSurfaces}) | ${s.resolvedAboveFold - base.resolvedAboveFold >= 0 ? '+' : ''}${s.resolvedAboveFold - base.resolvedAboveFold} | ${s.signsAbove} | ${(s.picShare * 100).toFixed(1)} % |\n`;
}
writeFileSync(path.join(outDir, 'measure.json'), JSON.stringify(result, null, 2));
writeFileSync(path.join(outDir, 'measure.md'), md);
console.log(md);
