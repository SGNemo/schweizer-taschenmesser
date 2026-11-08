/**
 * Renders the settings v3 mockups (default variant-a, variant-b, quick-capture-b; MOCKUPS=nav-a,nav-b for package 3) at 1280 and 412 px, light and dark, as jpg
 * into ../shots/mockup-<name>-<width>-<scheme>.jpg. Run from web/ (playwright-core resolves there):
 *   node ../docs/design/settings-v3/mockups/render.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
for (const f of (process.env.MOCKUPS ?? 'variant-a,variant-b,quick-capture-b').split(','))
  for (const scheme of ['light', 'dark'])
    for (const width of [1280, 412]) {
      const page = await browser.newPage({ viewport: { width, height: 700 }, colorScheme: scheme });
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href);
      await page.screenshot({ path: path.join(here, '..', 'shots', `mockup-${f}-${width}-${scheme}.jpg`), fullPage: true, type: 'jpeg', quality: 75 });
      await page.close();
    }
await browser.close();
