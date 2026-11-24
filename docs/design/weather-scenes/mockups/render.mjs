/**
 * Renders the weather-scene mockups at 1920 and 412 px, light and dark, as jpg into
 * web/.screens/weather-scenes/<name>-<width>-<scheme>.jpg (gitignored; images go into the PR text, never the repo).
 * Run from web/ (playwright-core resolves there):  node ../docs/design/weather-scenes/mockups/render.mjs
 * Some pages only:  MOCKUPS=01-lagen-tag,07-kopf node ../docs/design/weather-scenes/mockups/render.mjs
 * Without web/node_modules, the globally installed `playwright` is used. Chromium: /opt/pw-browsers/chromium.
 * 09-bewegung is shot after its animations have come to rest (about 13 s), i.e. it shows the still end frame.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
let chromium;
try { ({ chromium } = require('playwright-core')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../../../web/.screens/weather-scenes');
mkdirSync(out, { recursive: true });
const all = readdirSync(here).filter((f) => /^\d\d-.*\.html$/.test(f)).map((f) => f.slice(0, -5));
const names = process.env.MOCKUPS ? process.env.MOCKUPS.split(',') : all;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const f of names)
  for (const scheme of ['light', 'dark'])
    for (const [width, height] of [[1920, 1080], [412, 915]]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href);
      if (f.startsWith('09')) await page.waitForTimeout(13000);
      await page.screenshot({ path: path.join(out, `${f}-${width}-${scheme}.jpg`), fullPage: true, type: 'jpeg', quality: 80 });
      await page.close();
    }
await browser.close();
