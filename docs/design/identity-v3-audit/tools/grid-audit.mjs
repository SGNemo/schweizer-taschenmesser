// Contact sheet: node grid-audit.mjs <out.png> <cols> <cellWidth> <title> <png...>  (caption = file name without extension)
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const [out, colsArg, cellArg, title, ...files] = process.argv.slice(2);
const cols = Number(colsArg), cell = Number(cellArg);
const cells = files
  .filter((f) => existsSync(f))
  .map((f) => `<figure><img src="${pathToFileURL(path.resolve(f))}" width="${cell}"><figcaption>${path.basename(f, '.png')}</figcaption></figure>`)
  .join('');
const html = `<style>body{margin:0;padding:12px;background:#777;font:12px sans-serif;color:#fff}h2{margin:4px 0 8px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:10px;align-items:start}figure{margin:0}img{display:block;border:1px solid #444}figcaption{margin-top:2px}</style>
<h2>${title}</h2><div class="grid">${cells}</div>`;
const htmlFile = out.replace(/\.png$/, '.html');
writeFileSync(htmlFile, html);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: cols * (cell + 10) + 24, height: 600 } });
await page.goto(pathToFileURL(htmlFile).href);
await page.waitForLoadState('load');
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
