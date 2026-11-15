/**
 * Renders the planner-hub mockups (directions A, B, C and the states of the recommended one) at 1920×1080 and
 * 412×915, light and dark, first screen only, as jpg into web/.screens/planner-hub/mockup-<name>-<1920|412>-<light|dark>.jpg
 * (gitignored; the images live on the branch shots/planner-hub).
 * Run from web/ (playwright-core resolves there):  node ../docs/design/planner-hub/mockups/render.mjs
 * MOCKUPS=a,b limits the set; FULL=1 adds full-page images (…-full.jpg).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.cwd(), '.screens/planner-hub');
mkdirSync(out, { recursive: true });
// name → [file, query]; the states belong to the recommended direction A.
const PAGES = {
  a: ['direction-a.html', ''], b: ['direction-b.html', ''], c: ['direction-c.html', ''],
  'a-empty': ['direction-a.html', 'state=empty'], 'a-over': ['direction-a.html', 'state=over'],
  'a-late': ['direction-a.html', 'state=late'], 'a-many': ['direction-a.html', 'state=many'],
  'a-sheet': ['direction-a.html', 'sheet=1'],
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const name of (process.env.MOCKUPS ?? Object.keys(PAGES).join(',')).split(','))
  for (const scheme of ['light', 'dark'])
    for (const width of [1920, 412]) {
      const [file, query] = PAGES[name];
      if (name === 'a-sheet' && width !== 412) continue; // the capture sheet exists on the phone only
      const phone = width === 412;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 915 : 1080 }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, colorScheme: scheme, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(path.join(here, file)).href + (query ? '?' + query : ''));
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(out, `mockup-${name}-${width}-${scheme}.jpg`), type: 'jpeg', quality: 75 });
      if (process.env.FULL) await page.screenshot({ path: path.join(out, `mockup-${name}-${width}-${scheme}-full.jpg`), type: 'jpeg', quality: 75, fullPage: true });
      await ctx.close();
    }
await browser.close();
console.log('mockups in', out);
