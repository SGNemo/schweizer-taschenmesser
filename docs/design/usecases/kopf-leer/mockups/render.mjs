/**
 * Renders the „Kopf leer“ mockups (abladen, mail-plan, planer-ruhig) at 1280 and 412 px (mail-plan: 1280 only), light and dark, as jpg
 * into web/.screens/usecase-kopf-leer/mockup-<name>-<width>-<scheme>.jpg (gitignored; images go into the PR text).
 * Run from web/ (playwright-core resolves there):  node ../docs/design/usecases/kopf-leer/mockups/render.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '../../../../../web/.screens/usecase-kopf-leer');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const f of (process.env.MOCKUPS ?? 'abladen,mail-plan,planer-ruhig').split(','))
  for (const scheme of ['light', 'dark'])
    // mail-plan: desktop only – the mail module exists on the Windows app (ANALYSIS U06).
    for (const width of f === 'mail-plan' ? [1280] : [1280, 412]) {
      const page = await browser.newPage({ viewport: { width, height: 700 }, colorScheme: scheme });
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href);
      await page.screenshot({ path: path.join(out, `mockup-${f}-${width}-${scheme}.jpg`), fullPage: true, type: 'jpeg', quality: 75 });
      await page.close();
    }
await browser.close();
