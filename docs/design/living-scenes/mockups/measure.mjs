/**
 * Measures the living-scenes mockups. Writes web/.screens/living-scenes/measure.json and measure.md (gitignored) and
 * prints the markdown. Run from any directory:  node docs/design/living-scenes/mockups/measure.mjs   (RUNS=5 default)
 *  1. Pictures: elements (Scene.count) and markup KB as drawn, and "in view": only the leaf shapes whose box meets the
 *     picture, their groups and the gradients/masks/clips they reference – an estimate of what a kit that skips the
 *     layers outside the crop would draw.
 *  2. First contentful paint (pictures are drawn before it, synchronously) at 4× CPU throttle, median of RUNS.
 *  3. Contrast of the card inks on the Tageston (seven sky tones, light and dark), the tone-step search, the meta ink
 *     on a toned card, the clock's text on its sky per band (rendered pixels under the text), every sign colour ≥ 3:1.
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
  for (const [f, what] of [['p2-habits.html', 'garden'], ['p3-todos.html', 'lake']]) {
    await page.goto(url(f));
    for (const c of (await page.$$('.cell')).slice(0, 12)) {
      const label = await c.$eval('.label', (l) => l.childNodes[0].textContent).catch(() => '');
      const pic = await c.$('.card .pic');
      if (!pic || !/^(leer|wenig|normal|viel|besonders|Pausentag) · (breit|Streifen)$/.test(label)) continue;
      result.pictures.push({ what: what + ' · ' + label, ...(await pic.evaluate(eval(COST))) });
    }
  }
  await page.goto(url('p2-overview.html'));
  for (const sel of ['[data-card="habits"] .pic', '[data-card="todos"] .pic', '[data-card="weather"] .pic', '[data-card="clock"] .skyBg']) result.pictures.push({ what: 'overview · ' + sel.split('"')[1] + (sel.includes('sky') ? ' tile' : ''), ...(await (await page.$(sel)).evaluate(eval(COST))) });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(url('p2-overview.html'));
  for (const sel of ['[data-card="habits"] .pic', '[data-card="todos"] .pic', '[data-card="clock"] .skyBg']) result.pictures.push({ what: 'overview 412 · ' + sel.split('"')[1] + (sel.includes('sky') ? ' tile' : ' strip'), ...(await (await page.$(sel)).evaluate(eval(COST))) });
  await page.close();
}
// ---- 2. first paint, 4× CPU ----
for (const [name, f, q] of [['overview · bilder=aus', 'p2-overview.html', '?bilder=aus'], ['overview · verspielt (day)', 'p2-overview.html', ''], ['overview · verspielt (night)', 'p2-overview.html', '?sky=night'], ['habits gallery', 'p2-habits.html', ''], ['todos gallery', 'p3-todos.html', ''], ['clock gallery', 'p2-clock.html', ''], ['finance gallery', 'p2-finance.html', '']])
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
// ---- 3. contrast on the Tageston, dark step, meta ink, clock text on the sky, signs ----
const TONES = ['day', 'golden', 'dusk', 'night', 'overcast', 'rain', 'snow'];
const HELPERS = `
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', { willReadFrequently: true });
  const rgb = (c) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const cr = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const chroma = (c) => (Math.max(...c) - Math.min(...c)) / 255;
  const root = getComputedStyle(document.documentElement), V = (n) => rgb(root.getPropertyValue(n).trim());
  const INKS = { text: V('--text'), muted: V('--text-muted'), metaBase: V('--text-3-base'), meta: V('--text-3-on-tone'), accent: V('--accent'), danger: V('--danger') };
  const surface = (tone, step) => {
    const w = document.createElement('div'); w.dataset.sky = tone; if (step != null) w.style.setProperty('--tone', step + '%');
    w.innerHTML = '<section class="card"></section>'; document.body.appendChild(w);
    const bg = rgb(getComputedStyle(w.firstChild).backgroundColor); w.remove(); return bg;
  };`;
result.meta = {}; result.clock = [];
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: scheme, viewport: { width: 1920, height: 1080 } });
  await page.goto(url('p2-finance.html'));
  const r = await page.evaluate(`(() => { ${HELPERS}
    const TONES = ${JSON.stringify(TONES)}, rows = [], steps = [];
    for (const t of TONES) { const bg = surface(t), row = { tone: t, bg: hex(bg), chroma: +chroma(bg).toFixed(3) }; for (const k in INKS) row[k] = +cr(INKS[k], bg).toFixed(2); rows.push(row); }
    for (const st of [6, 8, 10, 12]) { const per = TONES.map((t) => { const bg = surface(t, st); return { t, text: cr(INKS.text, bg), muted: cr(INKS.muted, bg), meta: cr(INKS.metaBase, bg) }; });
      const w = (k) => per.reduce((a, b) => (b[k] < a[k] ? b : a)); steps.push({ step: st, text: +w('text').text.toFixed(2), muted: +w('muted').muted.toFixed(2), mutedAt: w('muted').t, metaBase: +w('meta').meta.toFixed(2), metaAt: w('meta').t }); }
    // the meta ink: --text-3 moved towards --text in steps of 1 % until it reaches 4.5:1 on the worst sky tone at the chosen step
    const bgs = TONES.map((t) => surface(t)); let found = null;
    for (let i = 0; i <= 100 && !found; i++) { const m = INKS.metaBase.map((x, j) => Math.round(x * (1 - i / 100) + INKS.text[j] * i / 100)); const worst = Math.min(...bgs.map((b) => cr(m, b))); if (worst >= 4.5) found = { percent: i, value: hex(m), worst: +worst.toFixed(2) }; }
    return { rows, steps, meta: { base: hex(INKS.metaBase), css: hex(INKS.meta), computed: found, step: root.getPropertyValue('--tone').trim() } };
  })()`);
  r.rows.forEach((x) => result.contrast.push({ scheme, ...x }));
  r.steps.forEach((x) => result.darkSteps.push({ scheme, ...x }));
  result.meta[scheme] = r.meta;
  // clock: the text on the sky. Text hidden, one screenshot, the pixels under each tile's text block sampled
  await page.goto(url('p2-clock.html'));
  const tiles = await page.evaluate(() => {
    document.documentElement.insertAdjacentHTML('beforeend', '<style>.kachel.sky > span { color: transparent !important; }</style>');
    return Array.from(document.querySelectorAll('.kachel.sky[data-hour]')).filter((k) => !k.closest('.calm')).map((k) => {
      const rs = Array.from(k.querySelectorAll('span')).map((s) => { const r = document.createRange(); r.selectNodeContents(s); return r.getBoundingClientRect(); });
      const x0 = Math.min(...rs.map((r) => r.left)), x1 = Math.max(...rs.map((r) => r.right)), y0 = Math.min(...rs.map((r) => r.top)), y1 = Math.max(...rs.map((r) => r.bottom));
      return { hour: +k.dataset.hour, ink: k.dataset.ink, w: Math.round(k.getBoundingClientRect().width), x: Math.floor(x0), y: Math.floor(y0 + scrollY), cw: Math.ceil(x1 - x0), ch: Math.ceil(y1 - y0) };
    });
  });
  const png = (await page.screenshot({ fullPage: true })).toString('base64');
  const cl = await page.evaluate(`(async () => { ${HELPERS}
    const img = new Image(); img.src = 'data:image/png;base64,${png}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const INK = { dark: [23, 31, 36], light: [236, 239, 241] };
    return ${JSON.stringify(tiles)}.map((t) => { const d = x.getImageData(t.x, t.y, t.cw, t.ch).data; let lo = [255, 255, 255], hi = [0, 0, 0], min = 99;
      for (let i = 0; i < d.length; i += 4) { const p = [d[i], d[i + 1], d[i + 2]], v = cr(INK[t.ink], p); if (v < min) min = v; if (lum(p) < lum(lo)) lo = p; if (lum(p) > lum(hi)) hi = p; }
      return { ...t, min: +min.toFixed(2), darkest: hex(lo), lightest: hex(hi) }; });
  })()`);
  const band = (h) => (h >= 21 || h < 6 ? 'night' : h < 8 ? 'morning' : h < 18 ? 'day' : 'evening');
  for (const b of ['night', 'morning', 'day', 'evening']) for (const [kind, f] of [['wide (≥ 300 px)', (t) => t.w >= 300], ['narrow (< 300 px)', (t) => t.w < 300]]) {
    const ts = cl.filter((t) => band(t.hour) === b && f(t)); if (!ts.length) continue;
    const worst = ts.reduce((a, c) => (c.min < a.min ? c : a));
    result.clock.push({ scheme, band: b, kind, tiles: ts.length, ink: [...new Set(ts.map((t) => t.ink))].join('/'), min: worst.min, at: String(worst.hour).padStart(2, '0') + ':00', darkest: worst.darkest, lightest: worst.lightest });
  }
  // signs: the one drawn colour of each sign on the card, per sky tone; the worst tone is reported
  await page.goto(url('p2-overview.html', '?bilder=ruhig'));
  const sg = await page.evaluate(`(() => { ${HELPERS}
    const out = {};
    for (const tone of ${JSON.stringify(TONES)}) { document.body.dataset.sky = tone;
      document.querySelectorAll('.sign').forEach((s) => { const card = s.closest('.card'), bg = rgb(getComputedStyle(card).backgroundColor);
        s.querySelectorAll('path, rect, circle, ellipse, line').forEach((e) => { if (e.closest('clipPath')) return; const cs = getComputedStyle(e);
          [cs.fill, cs.stroke].forEach((c) => { if (!c || c === 'none') return; const v = rgb(c); if (hex(v) === hex(bg)) return; const k = cr(v, bg), o = out[s.dataset.sign] || (out[s.dataset.sign] = { sign: s.dataset.sign, hue: card.dataset.hue, min: 99, at: '' }); if (k < o.min) { o.min = +k.toFixed(2); o.at = tone; } }); }); });
    }
    return Object.values(out);
  })()`);
  sg.forEach((x) => result.signs.push({ scheme, ...x }));
  await page.close();
}
// ---- 4. stimulus ----
for (const [w, h] of [[1920, 1080], [412, 915]])
  for (const [variant, q] of [['aus', '?bilder=aus'], ['verspielt · day', ''], ['verspielt · golden', '?sky=golden'], ['verspielt · night', '?sky=night'], ['ruhig · day', '?bilder=ruhig']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url('p2-overview.html', q));
    const app = await page.evaluate(`(${measurePageJs})()`);
    const extra = await page.evaluate(() => {
      const vpA = innerWidth * innerHeight; let pic = 0;
      document.querySelectorAll('.pic, .skyBg').forEach((el) => { const r = el.getBoundingClientRect(); const x = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), y = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); pic += x * y; });
      let all = 0; document.querySelectorAll('.pic, .skyBg').forEach((el) => { const r = el.getBoundingClientRect(); all += r.width * r.height; });
      return { svgRoots: document.querySelectorAll('svg').length, svgElements: document.querySelectorAll('svg, svg *').length, picShare: pic / vpA, picPage: all / (innerWidth * document.documentElement.scrollHeight) };
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
md += '\n## 3. Contrast on the Tageston (card surface = sky tone ' + result.meta.light.step + ' in srgb; bold = under 4.5:1)\n\nInks: text = --text (also link text), muted = --text-muted, meta today = --text-3 as it is, meta on tone = the new --text-3-on-tone, accent = --accent as text, danger = --danger (the red overdue text).\n\n| Scheme | Sky tone | Surface | Chroma | text | muted | meta today | meta on tone | accent | danger |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const c of result.contrast) md += `| ${c.scheme} | ${c.tone} | ${c.bg} | ${c.chroma.toFixed(3)} | ${flag(c.text, 4.5)} | ${flag(c.muted, 4.5)} | ${flag(c.metaBase, 4.5)} | ${flag(c.meta, 4.5)} | ${flag(c.accent, 4.5)} | ${flag(c.danger, 4.5)} |\n`;
md += '\n### Tone step search (worst sky tone per step; rule: --text and --text-muted ≥ 4.5:1)\n\n| Scheme | Step | text | muted (worst tone) | meta today (worst tone) | Passes |\n| --- | --- | --- | --- | --- | --- |\n';
for (const s of result.darkSteps) md += `| ${s.scheme} | ${s.step} % | ${f2(s.text)} | ${f2(s.muted)} (${s.mutedAt}) | ${flag(s.metaBase, 4.5)} (${s.metaAt}) | ${s.text >= 4.5 && s.muted >= 4.5 ? 'yes' : 'no'} |\n`;
md += '\n### The meta ink on a toned card\n\n| Scheme | Step | --text-3 today | --text-3-on-tone (mock.css) | Computed here (percent towards --text, worst contrast) |\n| --- | --- | --- | --- | --- |\n';
for (const k of ['light', 'dark']) { const m = result.meta[k]; md += `| ${k} | ${m.step} | ${m.base} | ${m.css} | ${m.computed.value} (${m.computed.percent} %, ${f2(m.computed.worst)}:1) |\n`; }
md += '\n### Clock: the text on the sky (pixels under the text block, text hidden; lowest contrast of the scene ink; bold = under 4.5:1)\n\n| Scheme | Band | Tiles | Ink | Lowest | At | Darkest / lightest pixel there |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for (const c of result.clock) md += `| ${c.scheme} | ${c.band} · ${c.kind} | ${c.tiles} | ${c.ink} | ${flag(c.min, 4.5)} | ${c.at} | ${c.darkest} / ${c.lightest} |\n`;
md += '\n### Signs: the drawn colour on the toned card, worst sky tone (≥ 3:1; bold = under)\n\n| Scheme | Sign | Hue | Lowest | On tone |\n| --- | --- | --- | --- | --- |\n';
for (const s of result.signs) md += `| ${s.scheme} | ${s.sign} | ${s.hue} | ${flag(s.min, 3)} | ${s.at} |\n`;
md += '\n## 4. Stimulus (first viewport of the overview, light; the app\'s measurePage as is, Δ against `aus`)\n\n| Viewport | Variant | svg roots | svg elements | coloured text | coloured surfaces | coloured above fold | Δ | pictures: share of first viewport | of the whole page |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const s of result.stimulus) {
  const b = result.stimulus.find((x) => x.vp === s.vp && x.variant === 'aus');
  md += `| ${s.vp} | ${s.variant} | ${s.svgRoots} (${sg(s.svgRoots - b.svgRoots)}) | ${s.svgElements} (${sg(s.svgElements - b.svgElements)}) | ${s.colouredText} | ${s.colouredSurfaces} | ${s.colouredAboveFold} | ${sg(s.colouredAboveFold - b.colouredAboveFold)} | ${(s.picShare * 100).toFixed(1)} % | ${(s.picPage * 100).toFixed(1)} % |\n`;
}
writeFileSync(path.join(outDir, 'measure.json'), JSON.stringify(result, null, 2));
writeFileSync(path.join(outDir, 'measure.md'), md);
console.log(md);
