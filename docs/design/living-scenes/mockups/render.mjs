/**
 * Renders the living-scenes mockups into web/.screens/living-scenes/ (gitignored; pictures go into the PR text, never
 * into the repo). Run from any directory:
 *   node docs/design/living-scenes/mockups/render.mjs              (everything)
 *   ONLY=overview,habits FORMAT=jpeg node docs/design/living-scenes/mockups/render.mjs
 * Overview: full page and first viewport (-vp) per variant; galleries: full page at 1920 light + dark and 412 light.
 * PR=1 (or ONLY=pr): also the compact JPEGs for the PR text into web/.screens/living-scenes/pr/ (each ≤ 400 KB).
 * Chromium: /opt/pw-browsers/chromium (the pre-installed playwright finds it; never `playwright install`).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../../../web/.screens/living-scenes');
mkdirSync(out, { recursive: true });
const jpeg = process.env.FORMAT === 'jpeg', ext = jpeg ? 'jpg' : 'png', shot = jpeg ? { type: 'jpeg', quality: 82 } : {};
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const href = (q) => pathToFileURL(path.join(here, q.split('?')[0])).href + (q.includes('?') ? '?' + q.split('?')[1] : '');
const OV = 'p2-overview.html';

// [name, file + query, width, scheme, also the first viewport]
const JOBS = [];
for (const sky of ['day', 'golden', 'dusk', 'night', 'overcast', 'rain']) JOBS.push([`overview-${sky}`, `${OV}?sky=${sky}`, 1920, 'light', 1]);
JOBS.push(['overview-day-aus', `${OV}?bilder=aus`, 1920, 'light', 1], ['overview-day-ruhig', `${OV}?bilder=ruhig`, 1920, 'light', 1], ['overview-day-areatone', `${OV}?tone=area`, 1920, 'light', 1],
  ['overview-day', OV, 1920, 'dark', 1], ['overview-night', `${OV}?sky=night`, 1920, 'dark', 1], ['overview-day', OV, 412, 'light', 1], ['overview-day', OV, 412, 'dark', 1],
  ['overview-golden', `${OV}?sky=golden`, 412, 'light', 1], ['overview-night', `${OV}?sky=night`, 412, 'light', 1]);
for (const [g, f] of [['habits', 'p2-habits.html'], ['todos', 'p3-todos.html'], ['clock', 'p2-clock.html'], ['finance', 'p2-finance.html']])
  for (const [w, s] of [[1920, 'light'], [1920, 'dark'], [412, 'light']]) JOBS.push([g, f, w, s, 0]);

const browser = await chromium.launch();
async function open(q, width, scheme) {
  const page = await browser.newPage({ viewport: { width, height: width < 700 ? 915 : 1080 }, colorScheme: scheme, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', q, e.message));
  await page.goto(href(q));
  await page.evaluate(() => document.fonts.ready);
  return page;
}
for (const [name, file, width, scheme, vp] of JOBS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const page = await open(file, width, scheme);
  const base = path.join(out, `${name}-${width}-${scheme}`);
  await page.screenshot({ path: `${base}.${ext}`, fullPage: true, ...shot });
  if (vp) await page.screenshot({ path: `${base}-vp.${ext}`, ...shot });
  await page.close();
  console.log(path.relative(process.cwd(), `${base}.${ext}`));
}

/* ---- PR pictures: crops laid out as a sheet (rows of pictures) in a canvas, JPEG q 0.82, scaled down until ≤ 400 KB ---- */
async function grab(q, width, scheme, from, to, opt = {}) {
  const page = await open(q, width, scheme);
  const r = await page.evaluate(({ from, to, opt }) => {
    const box = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right }; };
    const a = from ? box(from) : { top: 16 }, b = to ? box(to) : { bottom: (opt.height || document.documentElement.scrollHeight) - 16 }, frame = opt.frame ? box(opt.frame) : { left: 16, right: innerWidth - 16 };
    return { x: Math.max(0, frame.left - 16), y: Math.max(0, a.top - 16), width: Math.min(innerWidth, frame.right + 16) - Math.max(0, frame.left - 16), height: b.bottom - a.top + 32 };
  }, { from, to, opt });
  const buf = await page.screenshot({ fullPage: true, clip: r });
  await page.close();
  return buf;
}
async function compose(name, rows) {
  const page = await browser.newPage();
  const data = await page.evaluate(async (rows) => {
    const load = (b) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; return i.decode().then(() => i); };
    const R = await Promise.all(rows.map((r) => Promise.all(r.map(load)))), gap = 24;
    const W = Math.max(...R.map((r) => r.reduce((s, i) => s + i.width, 0) + gap * (r.length - 1))), H = R.reduce((s, r) => s + Math.max(...r.map((i) => i.height)), 0) + gap * (R.length - 1);
    for (let k = Math.min(1, 2400 / W); ; k *= 0.9) {
      const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
      const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      let y = 0;
      for (const r of R) { let x = 0; for (const i of r) { g.drawImage(i, x * k, y * k, i.width * k, i.height * k); x += i.width + gap; } y += Math.max(...r.map((i) => i.height)) + gap; }
      const url = c.toDataURL('image/jpeg', 0.82);
      if (url.length * 0.75 <= 400 * 1024 || k < 0.2) return { b64: url.slice(url.indexOf(',') + 1), k, w: c.width, h: c.height };
    }
  }, rows.map((r) => r.map((b) => b.toString('base64'))));
  await page.close();
  const file = path.join(out, 'pr', name + '.jpg'), buf = Buffer.from(data.b64, 'base64');
  writeFileSync(file, buf);
  console.log(path.relative(process.cwd(), file), Math.round(buf.length / 1024) + ' KB', data.w + '×' + data.h, 'scale ' + data.k.toFixed(2));
}
if (process.env.PR || (only && only.includes('pr'))) {
  mkdirSync(path.join(out, 'pr'), { recursive: true });
  const T = '[data-card="todos"]', H = '[data-card="habits"]', B = '[data-card="balance"]', K = '[data-card="clock"]', G = { frame: '.grid' };
  const rows = (q) => grab(q, 1920, 'light', T, K, G);
  await compose('overview-1920', [[await grab(OV, 1920, 'light')]]);
  await compose('overview-1920-top', [[await grab(OV, 1920, 'light', null, null, { height: 1400 })]]);
  await compose('tageszeiten', [[await rows(OV), await rows(OV + '?sky=golden')], [await rows(OV + '?sky=dusk'), await rows(OV + '?sky=night')]]);
  await compose('aus-vs-verspielt', [[await rows(OV + '?bilder=aus'), await rows(OV)]]);
  // the phone rows from "Offene ToDos" to "Uhrzeit anderswo" are about 3300 px tall: two files (ToDos + habits, then the rest)
  await compose('phone-hell-dunkel-1', [[await grab(OV, 412, 'light', T, H), await grab(OV, 412, 'dark', T, H)]]);
  await compose('phone-hell-dunkel-2', [[await grab(OV, 412, 'light', B, K), await grab(OV, 412, 'dark', B, K)]]);
  await compose('phone-nacht', [[await grab(OV + '?sky=night', 412, 'light', T, H), await grab(OV + '?sky=night', 412, 'light', B, K)]]);
  await compose('habits-zustaende', [[await grab('p2-habits.html', 1920, 'light', null, '.cells:nth-of-type(6)', { frame: '.gal' })]]);
  await compose('todos-zustaende', [[await grab('p3-todos.html', 1920, 'light', null, '.cells:nth-of-type(5)', { frame: '.gal' })]]);
  await compose('clock', [[await grab('p2-clock.html', 1920, 'light', null, null, { frame: '.gal' })]]);
}
await browser.close();
