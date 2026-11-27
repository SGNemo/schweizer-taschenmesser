/**
 * Renders the living-scenes mockups into web/.screens/living-scenes/ (gitignored; pictures go into the PR text, never
 * into the repo). Run from any directory:
 *   node docs/design/living-scenes/mockups/render.mjs              (everything)
 *   ONLY=overview,habits FORMAT=jpeg node docs/design/living-scenes/mockups/render.mjs
 * Overview: full page and first viewport (-vp) per variant; galleries: full page at 1920 light + dark and 412 light.
 * Chromium: /opt/pw-browsers/chromium (the pre-installed playwright finds it; never `playwright install`).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
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
  ['overview-day-T6-fit0', 'p2-overview.html?sky=day&tone=6&fit=0', 1920, 'light', 0], // the garden with the spot's own view (no widening)
  ['overview-night-T6', 'p2-overview.html?sky=night&tone=6', 1920, 'light', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 1920, 'dark', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 412, 'light', 1],
  ['overview-day-T6', 'p2-overview.html?sky=day&tone=6', 412, 'dark', 1],
  ['overview-evening-T6', 'p2-overview.html?sky=evening&tone=6', 412, 'light', 1],
];
for (const g of ['habits', 'clock', 'finance']) for (const [w, s] of [[1920, 'light'], [1920, 'dark'], [412, 'light']]) JOBS.push([g, `p2-${g}.html`, w, s, 0]);

const browser = await chromium.launch();
for (const [name, file, width, scheme, vp] of JOBS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
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
await browser.close();
