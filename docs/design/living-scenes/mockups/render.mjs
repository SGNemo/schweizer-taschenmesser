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

// [name, file + query, width, scheme, also the first viewport]
const JOBS = [
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 1920, 'light', 1],
  ['overview-day-T12', 'p2-overview.html?sky=day&tone=12', 1920, 'light', 1],
  ['overview-day-aus', 'p2-overview.html?sky=day&bilder=aus', 1920, 'light', 1],
  ['overview-day-ruhig', 'p2-overview.html?sky=day&bilder=ruhig', 1920, 'light', 1],
  ['overview-evening-T6', 'p2-overview.html?sky=evening&tone=6', 1920, 'light', 1],
  ['overview-night-T6', 'p2-overview.html?sky=night&tone=6', 1920, 'light', 1],
  ['overview-rain-T6', 'p2-overview.html?sky=rain&tone=6', 1920, 'light', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 1920, 'dark', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 412, 'light', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 412, 'dark', 1],
  ['overview-evening-T6', 'p2-overview.html?sky=evening&tone=6', 412, 'light', 1],
];
for (const g of ['habits', 'clock', 'finance']) for (const [w, s] of [[1920, 'light'], [1920, 'dark'], [412, 'light']]) JOBS.push([g, `p2-${g}.html`, w, s, 0]);

const browser = await chromium.launch();
for (const [name, file, width, scheme, vp] of JOBS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  if (only && only.includes('pr') && only.length === 1) continue;
  const page = await browser.newPage({ viewport: { width, height: width < 700 ? 915 : 1080 }, colorScheme: scheme, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', name, e.message));
  await page.goto(pathToFileURL(path.join(here, file.split('?')[0])).href + (file.includes('?') ? '?' + file.split('?')[1] : ''));
  await page.evaluate(() => document.fonts.ready);
  const base = path.join(out, `${name}-${width}-${scheme}`);
  await page.screenshot({ path: `${base}.${ext}`, fullPage: true, ...shot });
  if (vp) await page.screenshot({ path: `${base}-vp.${ext}`, ...shot });
  await page.close();
  console.log(path.relative(process.cwd(), `${base}.${ext}`));
}

/* ---- PR pictures: crops composed side by side in a canvas, JPEG q 0.82, scaled down until ≤ 400 KB ---- */
async function grab(q, width, scheme, from, to, opt = {}) {
  const page = await browser.newPage({ viewport: { width, height: width < 700 ? 915 : 1080 }, colorScheme: scheme, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(here, q.split('?')[0])).href + (q.includes('?') ? '?' + q.split('?')[1] : ''));
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(({ from, to, opt }) => {
    const box = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right }; };
    const a = from ? box(from) : { top: 0 }, b = to ? box(to) : { bottom: opt.height || document.documentElement.scrollHeight }, frame = opt.frame ? box(opt.frame) : { left: 0, right: innerWidth };
    return { x: Math.max(0, frame.left - 16), y: Math.max(0, a.top - 16), width: Math.min(innerWidth, frame.right + 16) - Math.max(0, frame.left - 16), height: b.bottom - a.top + 32 };
  }, { from, to, opt });
  const buf = await page.screenshot({ fullPage: true, clip: r });
  await page.close();
  return buf;
}
async function compose(name, bufs) {
  const page = await browser.newPage();
  const data = await page.evaluate(async (b64s) => {
    const imgs = await Promise.all(b64s.map((b) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; return i.decode().then(() => i); }));
    const gap = 24, W = imgs.reduce((s, i) => s + i.width, 0) + gap * (imgs.length - 1), H = Math.max(...imgs.map((i) => i.height));
    for (let k = Math.min(1, 2400 / W); ; k *= 0.88) {
      const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
      const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      let x = 0; for (const i of imgs) { g.drawImage(i, x * k, 0, i.width * k, i.height * k); x += i.width + gap; }
      const url = c.toDataURL('image/jpeg', 0.82);
      if (url.length * 0.75 <= 400 * 1024 || k < 0.2) return url.slice(url.indexOf(',') + 1);
    }
  }, bufs.map((b) => b.toString('base64')));
  await page.close();
  const file = path.join(out, 'pr', name + '.jpg');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(path.relative(process.cwd(), file), Math.round(Buffer.from(data, 'base64').length / 1024) + ' KB');
}
if (process.env.PR || (only && only.includes('pr'))) {
  mkdirSync(path.join(out, 'pr'), { recursive: true });
  const ROWS = ['[data-card="todos"]', '[data-card="clock"]'], G = { frame: '.grid' };
  await compose('overview-1920', [await grab('p2-overview.html?sky=day&tone=6', 1920, 'light')]);
  await compose('overview-1920-top', [await grab('p2-overview.html?sky=day&tone=6', 1920, 'light', null, null, { height: 1400 })]);
  await compose('aus-vs-verspielt', [await grab('p2-overview.html?sky=day&bilder=aus', 1920, 'light', ...ROWS, G), await grab('p2-overview.html?sky=day&tone=6', 1920, 'light', ...ROWS, G)]);
  await compose('abend-nacht', [await grab('p2-overview.html?sky=evening&tone=6', 1920, 'light', ...ROWS, G), await grab('p2-overview.html?sky=night&tone=6', 1920, 'light', ...ROWS, G)]);
  const P = ['[data-card="habits"]', '[data-card="clock"]'];
  await compose('phone-hell-dunkel', [await grab('p2-overview.html?sky=day&tone=6', 412, 'light', ...P), await grab('p2-overview.html?sky=day&tone=6', 412, 'dark', ...P)]);
  await compose('habits-zustaende', [await grab('p2-habits.html', 1920, 'light', null, '.cells:nth-of-type(6)', { frame: '.gal' })]);
  await compose('clock', [await grab('p2-clock.html', 1920, 'light', null, null, { frame: '.gal' })]);
  await compose('finance', [await grab('p2-finance.html', 1920, 'light', null, null, { frame: '.gal' })]);
}
await browser.close();
