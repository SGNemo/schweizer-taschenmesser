#!/usr/bin/env node
/* global process, console */
// Manual tooling: lays screenshots side by side in one PNG for a PR text (one picture instead of twenty).
// Usage (in web/): node e2e/screenshots/montage.mjs <dir> <filename filter> <page width> <columns> <out.png>
// e.g. node e2e/screenshots/montage.mjs .screens/weather head-412-dark 1300 3 .screens/heads-412-dark.png
// The images are embedded as data: URLs – a page set with setContent cannot load file:// images (they come out empty).
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const [dir, filter, width, cols, out] = process.argv.slice(2);
if (!dir || !filter || !width || !cols || !out) {
  console.error(
    'usage: node e2e/screenshots/montage.mjs <dir> <filter> <width> <columns> <out.png>',
  );
  process.exit(1);
}
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.png') && f.includes(filter))
  .sort();
if (files.length === 0) {
  console.error(`no PNG in ${dir} contains "${filter}"`);
  process.exit(1);
}
// The label is the scenario id (the part of the name before "-head-", "-card-" …).
const label = (f) => f.replace(/-(head|card|air|days|overview|page)-.*$/, '');
const cell = (f) =>
  `<figure style="margin:0"><figcaption style="font:13px system-ui;color:#fff;padding:2px 0">${label(f)}</figcaption>` +
  `<img src="data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}" style="display:block;max-width:100%"></figure>`;
const html = `<body style="margin:0;padding:8px;background:#555;display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px">${files.map(cell).join('')}</body>`;

const executablePath = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: Number(width), height: 600 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`${out}: ${files.length} pictures`);
