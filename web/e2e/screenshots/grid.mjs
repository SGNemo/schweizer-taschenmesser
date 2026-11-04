#!/usr/bin/env node
// Manual tooling: lays the screenshots of identity-v3.spec.ts side by side, "all modules next to each other".
// Usage (in web/): node e2e/screenshots/grid.mjs <dir with before/ and after/> <out dir> [modules,comma,separated]
// Per viewport and colour scheme (reading aid off and on) one PNG: a row "before", a row "after", one column per module.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const [root, out, modulesArg] = process.argv.slice(2);
if (!root || !out) {
  console.error('usage: node e2e/screenshots/grid.mjs <root> <out> [modules]');
  process.exit(1);
}
const modules = modulesArg ? modulesArg.split(',') : ['pantry', 'lists', 'vault', 'accounts'];
const viewports = ['1920x1080', '2560x1440', '1280x720', '412x915'];
const variants = readdirSync(path.join(root, 'after')).filter((d) =>
  /^(light|dark)-read(on|off)$/.test(d),
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
});
for (const variant of variants)
  for (const vp of viewports) {
    const phone = vp.startsWith('412');
    const cell = phone ? 220 : 480; // px width of one module column
    const cells = (side) =>
      modules
        .map((m) => {
          const file = path.join(root, side, variant, `${vp}--${m}.png`);
          return existsSync(file)
            ? `<figure><img src="${pathToFileURL(file)}" width="${cell}"><figcaption>${m}</figcaption></figure>`
            : '';
        })
        .join('');
    const html = `<style>body{margin:0;padding:12px;background:#888;font:12px sans-serif;color:#fff}
      h2{margin:8px 0 4px}.row{display:flex;gap:8px;align-items:flex-start}figure{margin:0}img{display:block}</style>
      <h2>before · ${variant} · ${vp}</h2><div class="row">${cells('before')}</div>
      <h2>after · ${variant} · ${vp}</h2><div class="row">${cells('after')}</div>`;
    const page = await browser.newPage({
      viewport: { width: cell * modules.length + 8 * modules.length + 24, height: 600 },
    });
    const htmlFile = path.resolve(out, `grid-${variant}-${vp}.html`);
    writeFileSync(htmlFile, html);
    await page.goto(pathToFileURL(htmlFile).href);
    await page.waitForLoadState('load');
    await page.screenshot({ path: path.join(out, `grid-${variant}-${vp}.png`), fullPage: true });
    await page.close();
  }
await browser.close();
console.log(`grids written to ${out}`);
