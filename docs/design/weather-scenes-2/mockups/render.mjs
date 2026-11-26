/**
 * Renders the round-2 mockups at 1920 and 412 px, light and dark, into web/.screens/weather-scenes-2/ (gitignored;
 * pictures go into the PR text, never into the repo). Run from the repo root or web/:
 *   node docs/design/weather-scenes-2/mockups/render.mjs            (all pages)
 *   MOCKUPS=p2-stile node docs/design/weather-scenes-2/mockups/render.mjs      (SCHEMES=light, FORMAT=jpeg as needed)
 * A page whose sections carry class "style" is shot section by section (<page>-<sectionId>-<width>-<scheme>.png),
 * every other page as one full-page picture. Chromium: /opt/pw-browsers/chromium (the pre-installed playwright finds it).
 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../../../web/.screens/weather-scenes-2');
mkdirSync(out, { recursive: true });
const all = readdirSync(here).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
const names = process.env.MOCKUPS ? process.env.MOCKUPS.split(',') : all;
const schemes = (process.env.SCHEMES || 'light,dark').split(',');
const jpeg = process.env.FORMAT === 'jpeg', ext = jpeg ? 'jpg' : 'png', shot = jpeg ? { type: 'jpeg', quality: 82 } : {}; // FORMAT=jpeg: smaller files for the PR text
const browser = await chromium.launch();
for (const f of names)
  for (const scheme of schemes)
    for (const [width, height] of [[1920, 1080], [412, 915]]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: width < 700 ? 2 : 1 });
      page.on('pageerror', (e) => console.log('ERR', f, e.message));
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href);
      const sections = await page.$$('section.style');
      if (sections.length) for (const s of sections) await s.screenshot({ path: path.join(out, `${f}-${await s.getAttribute('id')}-${width}-${scheme}.${ext}`), ...shot });
      else await page.screenshot({ path: path.join(out, `${f}-${width}-${scheme}.${ext}`), fullPage: true, ...shot });
      await page.close();
    }
await browser.close();
