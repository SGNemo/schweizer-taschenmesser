/**
 * Renders each direction-*.html at 1280 px (desktop) and 360 px (phone), dark and light, and
 * composes one sheet per direction: out/direction-<x>.png (desktop + phone, dark on top, light
 * below; SHEET_ROW=1 puts all four side by side for long pages). Run from site/ so playwright-core and sharp resolve:  node ../docs/design/site/render.mjs
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
await mkdir(out, { recursive: true });
const files = (process.env.MOCKUPS || 'direction-a,direction-b,direction-c').split(',');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const GAP = 24, PHONE_W = 400;
for (const f of files) {
  const shots = {};
  for (const scheme of ['dark', 'light']) {
    for (const [key, width, dpr] of [['desk', 1280, 1], ['phone', 360, 2]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      await page.goto(pathToFileURL(path.join(here, f + '.html')).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      let buf = await page.screenshot({ fullPage: true });
      if (key === 'phone') buf = await sharp(buf).resize({ width: PHONE_W }).png().toBuffer();
      shots[`${key}-${scheme}`] = buf;
      await page.close();
    }
  }
  const meta = {};
  for (const k of Object.keys(shots)) meta[k] = await sharp(shots[k]).metadata();
  const rowH = (s) => Math.max(meta[`desk-${s}`].height, meta[`phone-${s}`].height);
  const W = 1280 + GAP + PHONE_W + 2 * GAP, H = rowH('dark') + rowH('light') + 3 * GAP;
  const comp = [];
  let y = GAP;
  if (process.env.SHEET_ROW) {
    // One row (long pages): desktop dark, phone dark, desktop light, phone light.
    let x = GAP;
    for (const s of ['dark', 'light']) {
      comp.push({ input: shots[`desk-${s}`], left: x, top: GAP }); x += 1280 + GAP;
      comp.push({ input: shots[`phone-${s}`], left: x, top: GAP }); x += PHONE_W + GAP;
    }
  } else {
    for (const s of ['dark', 'light']) {
      comp.push({ input: shots[`desk-${s}`], left: GAP, top: y }, { input: shots[`phone-${s}`], left: GAP + 1280 + GAP, top: y });
      y += rowH(s) + GAP;
    }
  }
  const size = process.env.SHEET_ROW ? { width: 2 * (1280 + PHONE_W) + 5 * GAP, height: Math.max(rowH('dark'), rowH('light')) + 2 * GAP } : { width: W, height: H };
  await sharp({ create: { ...size, channels: 3, background: '#555' } }).composite(comp).png({ compressionLevel: 9 }).toFile(path.join(out, f + '.png'));
  console.log(f + '.png');
}
await browser.close();
