/**
 * Measures the living-scenes mockups. Writes web/.screens/living-scenes/measure.json and measure.md (gitignored) and
 * prints the markdown. Run from any directory:  node docs/design/living-scenes/mockups/measure.mjs   (RUNS=5 default)
 *  1. Pictures: elements (Scene.count) and markup KB as drawn, and "in view": only the leaf shapes whose box meets the
 *     picture, their groups and the gradients/masks/clips they reference – an estimate of what a kit that skips the
 *     layers outside the crop would draw.
 *  2. First contentful paint (pictures are drawn before it, synchronously) at 4× CPU throttle, median of RUNS.
 *  3. Contrast of the card inks on the toned surface (six areas, light and dark), the dark tone-step search
 *     (contrast ≥ 4.5:1 for every ink AND chroma ≤ 0.06 by the app's rule), and every data-carrying sign colour ≥ 3:1.
 *  4. Stimulus: the app's own `measurePage` (web/scripts/lib/stimulusBudget.ts, transpiled at run time, unchanged) on
 *     the overview's first viewport per variant; svg counts; share of the viewport covered by pictures.
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
const measurePageJs = ts.transpile(fn.replace('export ', ''), { target: ts.ScriptTarget.ES2020 }).replace(/^"use strict";/, '').trim();
const url = (f, q = '') => pathToFileURL(path.join(here, f)).href + q;
const browser = await chromium.launch();
const result = { date: new Date().toISOString().slice(0, 10), pictures: [], paint: [], contrast: [], darkSteps: [], surfaces: [], signs: [], stimulus: [] };

/* in the page: drawn and in-view cost of the svg inside `el` */
const COST = `(el) => {
  const svg = el.querySelector('svg'), box = el.getBoundingClientRect(), TAGS = /^(path|rect|circle|ellipse|g|stop|linearGradient|radialGradient|mask)$/;
  const all = Array.from(svg.querySelectorAll('*')), drawn = all.filter((e) => TAGS.test(e.tagName)).length;
  const hidden = (e) => e.closest('defs, mask, clipPath, pattern, linearGradient, radialGradient');
  const leaves = all.filter((e) => /^(path|rect|circle|ellipse|line|polygon|polyline|use)$/.test(e.tagName) && !hidden(e)).filter((e) => {
    const r = e.getBoundingClientRect();
    return (r.width > 0 || r.height > 0) && r.right >= box.left && r.left <= box.right && r.bottom >= box.top && r.top <= box.bottom;
  });
  const keep = new Set(leaves);
  leaves.forEach((e) => { for (let p = e.parentElement; p && p !== svg; p = p.parentElement) keep.add(p); });
  const refs = new Set();
  const scan = (e) => ['fill', 'stroke', 'mask', 'clip-path', 'filter'].forEach((a) => { const m = /url\\(#([^)]+)\\)/.exec(e.getAttribute(a) || ''); if (m) { const d = svg.getElementById(m[1]); if (d && !refs.has(d)) { refs.add(d); d.querySelectorAll('*').forEach(scan); scan(d); const h = d.getAttribute('href') || d.getAttribute('xlink:href'); if (h) { const t = svg.getElementById(h.slice(1)); if (t) { refs.add(t); scan(t); } } } } });
  keep.forEach(scan);
  let n = 0, bytes = 0;
  keep.forEach((e) => { if (TAGS.test(e.tagName)) n++; bytes += e.tagName === 'g' ? e.outerHTML.length - e.innerHTML.length : e.outerHTML.length; });
  refs.forEach((d) => { n += [d, ...d.querySelectorAll('*')].filter((x) => TAGS.test(x.tagName)).length; bytes += d.outerHTML.length; });
  return { px: Math.round(box.width) + '×' + Math.round(box.height), els: drawn, kb: svg.outerHTML.length / 1024, inEls: n, inKb: bytes / 1024 };
}`;

// ---- 1. pictures ----
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url('p2-habits.html'));
  for (const c of (await page.$$('.cell')).slice(0, 40)) {
    const label = await c.$eval('.label', (l) => l.childNodes[0].textContent).catch(() => '');
    const pic = await c.$('.card .pic');
    if (!pic || !/ · (breit|Streifen)$/.test(label) || /Tag|Stunde|Dämmerung|Nacht|Regen|Schnee/.test(label)) continue;
    result.pictures.push({ what: 'garden · ' + label, ...(await pic.evaluate(eval(COST))) });
  }
  await page.goto(url('p2-overview.html'));
  for (const sel of ['[data-card="habits"] .pic', '[data-card="weather"] .pic', '[data-card="clock"] .skyPanel']) result.pictures.push({ what: 'overview · ' + sel.split('"')[1] + (sel.includes('sky') ? ' tile' : ''), ...(await (await page.$(sel)).evaluate(eval(COST))) });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(url('p2-overview.html'));
  result.pictures.push({ what: 'overview 412 · habits strip', ...(await (await page.$('[data-card="habits"] .pic')).evaluate(eval(COST))) });
  result.pictures.push({ what: 'overview 412 · clock porthole', ...(await (await page.$('[data-card="clock"] .skyPanel')).evaluate(eval(COST))) });
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
// ---- 3. contrast, tone steps, signs ----
const AREAS = ['plan', 'money', 'household', 'knowledge', 'vault', 'system'];
const HELPERS = `
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
  const rgb = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const cr = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  const chroma = (c) => (Math.max(...c) - Math.min(...c)) / 255;
  const plain = new Set(['--bg', '--surface', '--surface-2', '--surface-raised', '--surface-sunken'].map((n) => hex(rgb(getComputedStyle(document.documentElement).getPropertyValue(n).trim()))));
  const INKS = { text: '--text', muted: '--text-muted', meta: '--text-3', accent: '--accent', danger: '--danger' };
  const probe = (area, tone) => {
    const el = document.createElement('section'); el.className = 'card'; el.dataset.area = area; if (tone != null) el.style.setProperty('--tone', tone + '%');
    document.body.appendChild(el);
    const cs = getComputedStyle(el), bg = rgb(cs.backgroundColor), row = { area, bg: hex(bg), chroma: +chroma(bg).toFixed(3) };
    row.counts = !plain.has(row.bg) && chroma(bg) > 0.06;
    for (const k in INKS) row[k] = +cr(rgb(cs.getPropertyValue(INKS[k]).trim()), bg).toFixed(2);
    row.min = Math.min(...Object.keys(INKS).map((k) => row[k]));
    el.remove(); return row;
  };`;
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: scheme });
  await page.goto(url('p2-finance.html'));
  const r = await page.evaluate(`(() => { ${HELPERS}
    const def = getComputedStyle(document.documentElement).getPropertyValue('--tone-6').trim();
    const rows = [], steps = [], surfaces = [];
    for (const area of ${JSON.stringify(AREAS)}) for (const t of [0, null, 12]) rows.push({ tone: t == null ? 'T6 (' + def + ')' : 'T' + t, ...probe(area, t) });
    if (${JSON.stringify(scheme)} === 'dark') for (const t of [4, 6, 8, 10, 12]) for (const area of ${JSON.stringify(AREAS)}) steps.push({ step: t, ...probe(area, t) });
    for (const area of ${JSON.stringify(AREAS)}) surfaces.push({ tone: def, ...probe(area, null) });
    return { rows, steps, surfaces, def };
  })()`);
  r.rows.forEach((x) => result.contrast.push({ scheme, ...x }));
  r.steps.forEach((x) => result.darkSteps.push(x));
  r.surfaces.forEach((x) => result.surfaces.push({ scheme, ...x }));
  // signs: every drawn colour that is not the card surface carries data or structure in the main tone: ≥ 3:1 on the card
  for (const tone of scheme === 'light' ? ['6', '12'] : ['6']) {
    await page.goto(url('p2-overview.html', '?bilder=ruhig&tone=' + tone));
    const s = await page.evaluate(`(() => { ${HELPERS}
      return Array.from(document.querySelectorAll('.sign')).map((sg) => {
        const card = sg.closest('.card'), bg = rgb(getComputedStyle(card).backgroundColor), seen = {};
        sg.querySelectorAll('path, rect, circle, ellipse, line').forEach((e) => { if (e.closest('clipPath')) return; const cs = getComputedStyle(e);
          [cs.fill, cs.stroke].forEach((c) => { if (!c || c === 'none' || /^rgba\\(0, 0, 0, 0\\)$/.test(c)) return; const v = rgb(c), h = hex(v); if (h !== hex(bg)) seen[h] = +cr(v, bg).toFixed(2); }); });
        const vals = Object.values(seen);
        return { sign: sg.dataset.sign, area: card.dataset.area, hue: card.dataset.hue, colours: Object.keys(seen).length, min: Math.min(...vals) };
      });
    })()`);
    s.forEach((x) => result.signs.push({ scheme, tone: scheme === 'dark' ? r.def : tone + '%', ...x }));
  }
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
    result.stimulus.push({ vp: w + '×' + h, variant, ...extra, colouredText: app.colouredText, colouredSurfaces: app.colouredSurfaces, colouredAboveFold: app.colouredText + app.colouredSurfaces, borders: app.borders, shadows: app.shadows });
    await page.close();
  }
await browser.close();

// ---- report ----
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), flag = (v, min) => (v < min ? `**${f2(v)}**` : f2(v)), sg = (v) => (v >= 0 ? '+' : '') + v;
let md = `# Living scenes – mockup measurement\n\n${result.date} · Chromium (playwright) · paint: 4× CPU, median of ${RUNS}\n\n`;
md += '## 1. Pictures\n\nCeilings (weather-scenes-2/A11Y.md §4): **≤ 220 elements** in the scene SVG, markup **≤ 64 KB** (round 2), first paint within one frame (phone profile, 4× CPU). "In view" = leaf shapes whose box meets the picture, their groups and the defs they reference.\n\n| Picture | Box px | Elements drawn | KB drawn | Elements in view | KB in view |\n| --- | --- | --- | --- | --- | --- |\n';
for (const p of result.pictures) md += `| ${p.what} | ${p.px} | ${p.els} | ${f1(p.kb)} | ${p.inEls} | ${f1(p.inKb)} |\n`;
md += '\n## 2. First contentful paint (4× CPU)\n\n| Page | Viewport | FCP ms |\n| --- | --- | --- |\n';
for (const p of result.paint) md += `| ${p.name} | ${p.vp} | ${f1(p.fcp)} |\n`;
md += '\n## 3. Contrast on the toned card surface (tone mixed in srgb; bold = under 4.5:1)\n\nInks: text = --text (also link text), muted = --text-muted, meta = --text-3, accent = --accent as text, danger = --danger (the red overdue text). T6 = the default step (light 6 %, dark the step in mock.css).\n\n| Scheme | Area | Tone | Surface | text | muted | meta | accent | danger |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const c of result.contrast) md += `| ${c.scheme} | ${c.area} | ${c.tone} | ${c.bg} | ${flag(c.text, 4.5)} | ${flag(c.muted, 4.5)} | ${flag(c.meta, 4.5)} | ${flag(c.accent, 4.5)} | ${flag(c.danger, 4.5)} |\n`;
md += '\n### Dark tone step search\n\nRule: every ink ≥ 4.5:1 on all six areas AND chroma (max − min)/255 ≤ 0.06 (the app\'s `CHROMA_SURFACE`). 4 % is outside the asked set, listed for information.\n\n| Step | Area | Surface | Chroma | Counts as colour | Lowest ink (meta) |\n| --- | --- | --- | --- | --- | --- |\n';
for (const s of result.darkSteps) md += `| ${s.step} % | ${s.area} | ${s.bg} | ${s.chroma.toFixed(3)} | ${s.counts ? '**yes**' : 'no'} | ${flag(s.min, 4.5)} |\n`;
md += '\n| Step | All inks ≥ 4.5:1 | No area counts | Passes |\n| --- | --- | --- | --- |\n';
for (const t of [4, 6, 8, 10, 12]) { const r = result.darkSteps.filter((x) => x.step === t), a = r.every((x) => x.min >= 4.5), b = r.every((x) => !x.counts); md += `| ${t} % | ${a ? 'yes' : 'no (' + f2(Math.min(...r.map((x) => x.min))) + ')'} | ${b ? 'yes' : 'no (' + r.filter((x) => x.counts).map((x) => x.area).join(', ') + ')'} | ${a && b ? '**yes**' : 'no'} |\n`; }
md += '\n### The default step per area (light T6 and the dark step): surface, chroma by the app\'s rule, would it count\n\n| Scheme | Step | Area | Surface | Chroma | Counts |\n| --- | --- | --- | --- | --- | --- |\n';
for (const s of result.surfaces) md += `| ${s.scheme} | ${s.tone} | ${s.area} | ${s.bg} | ${s.chroma.toFixed(3)} | ${s.counts ? '**yes**' : 'no'} |\n`;
md += '\n### Signs: every drawn colour except the card surface, lowest contrast on the toned card (≥ 3:1; bold = under)\n\n| Scheme | Tone | Sign | Hue / area | Colours | Lowest |\n| --- | --- | --- | --- | --- | --- |\n';
for (const s of result.signs) md += `| ${s.scheme} | ${s.tone} | ${s.sign} | ${s.hue} / ${s.area} | ${s.colours} | ${flag(s.min, 3)} |\n`;
md += '\n## 4. Stimulus (first viewport of the overview, light; the app\'s measurePage as is, Δ against `aus`)\n\n| Viewport | Variant | svg roots | svg elements | coloured text | coloured surfaces | coloured above fold | Δ | signs above fold | picture share |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const s of result.stimulus) {
  const b = result.stimulus.find((x) => x.vp === s.vp && x.variant === 'aus');
  md += `| ${s.vp} | ${s.variant} | ${s.svgRoots} (${sg(s.svgRoots - b.svgRoots)}) | ${s.svgElements} (${sg(s.svgElements - b.svgElements)}) | ${s.colouredText} | ${s.colouredSurfaces} | ${s.colouredAboveFold} | ${sg(s.colouredAboveFold - b.colouredAboveFold)} | ${s.signsAbove} | ${(s.picShare * 100).toFixed(1)} % |\n`;
}
writeFileSync(path.join(outDir, 'measure.json'), JSON.stringify(result, null, 2));
writeFileSync(path.join(outDir, 'measure.md'), md);
console.log(md);
