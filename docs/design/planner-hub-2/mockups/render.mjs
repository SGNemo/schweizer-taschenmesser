/**
 * Renders the planner-hub-2 mockups at 1920 and 412 px, light and dark, as jpg into
 * web/.screens/planner-hub-2/<name>-<width>-<scheme>.jpg (gitignored; images go into the PR text).
 * Run from web/ (playwright-core resolves there):  node ../docs/design/planner-hub-2/mockups/render.mjs
 * One file only: MOCKUPS=04-expand-a,05-los node ../docs/design/planner-hub-2/mockups/render.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../../../web/.screens/planner-hub-2');
mkdirSync(out, { recursive: true });
const all = readdirSync(here).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
const names = process.env.MOCKUPS ? process.env.MOCKUPS.split(',') : all;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const f of names)
  for (const scheme of ['light', 'dark'])
    for (const [width, height] of [[1920, 1080], [412, 915]]) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href);
      await page.screenshot({ path: path.join(out, `${f}-${width}-${scheme}.jpg`), fullPage: true, type: 'jpeg', quality: 78 });
      await page.close();
    }
await browser.close();
