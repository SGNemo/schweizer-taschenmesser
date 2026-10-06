/**
 * Renders the built site in Chromium at several widths, light and dark, for the PR and for a
 * quick visual check. Needs a running preview (`npm run preview`) or SITE_PREVIEW_URL.
 * Output: out/<page>-<width>-<scheme>.png. Chromium: PLAYWRIGHT_CHROMIUM or the pinned path.
 */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = process.env.SITE_PREVIEW_URL || 'http://localhost:4321';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
await mkdir(out, { recursive: true });
const widths = (process.env.SITE_WIDTHS || '360,768,1280,1920').split(',').map(Number);
const pages = (process.env.SITE_PAGES || '/,/en,/impressum').split(',');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const p of pages) {
  for (const width of widths) {
    for (const scheme of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: width < 800 ? 2 : 1, reducedMotion: 'reduce' });
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const name = (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '-')) + `-${width}-${scheme}.png`;
      await page.screenshot({ path: path.join(out, name), fullPage: true });
      await page.close();
      console.log(name);
    }
  }
}
await browser.close();
