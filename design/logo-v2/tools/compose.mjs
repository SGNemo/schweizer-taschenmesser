// Before / after sheets from two sets of app screenshots made by tools/app-after.mjs: the "before" from a
// build of the base branch (old logo), the "after" from this branch, both with the same sidebar.
//
//   node tools/compose.mjs <beforeDir> <afterDir> <outDir>
//   -> <outDir>/before-after-sidebar.png (wide + rail, light/dark), before-after-phone.png (phone top bar, splash)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve(import.meta.dirname, '../../../web/node_modules/@playwright/test'));
const [beforeDir, afterDir, outDir] = process.argv.slice(2).map((p) => resolve(p));
const uri = (dir, name) => `data:image/png;base64,${readFileSync(join(dir, `${name}.png`)).toString('base64')}`;

const cell = (dir, name, w) => `<img src="${uri(dir, name)}" style="width:${w}px;display:block;border:1px solid #c9ced4;border-radius:6px">`;
const sheet = (title, rows, w) => `<style>
  body{margin:0;padding:20px 24px;background:#fff;font:13px Inter,system-ui,sans-serif;color:#1f2933;width:${2 * w + 90}px}
  h2{font-size:15px;margin:0 0 14px}
  .grid{display:grid;grid-template-columns:${w}px ${w}px;gap:14px 24px}
  .h{font-size:12px;color:#4b5563;text-transform:uppercase;letter-spacing:.04em}
  .l{grid-column:1/3;color:#4b5563;margin-top:6px}
</style><h2>${title}</h2><div class="grid"><div class="h">Before</div><div class="h">After</div>
${rows.map(([label, name]) => `<div class="l">${label}</div>${cell(beforeDir, name, w)}${cell(afterDir, name, w)}`).join('')}</div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });
const shoot = async (html, file) => {
  await page.setContent(html);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, file), fullPage: true });
};
await shoot(
  sheet('Sidebar head, expanded and collapsed', [['Expanded, light', 'wide-light'], ['Expanded, dark', 'wide-dark'], ['Collapsed, light', 'rail-light'], ['Collapsed, dark', 'rail-dark']], 420),
  'before-after-sidebar.png',
);
await shoot(
  sheet('Phone top bar and splash', [['Phone top bar, mark (below 416 px)', 'phone-mark-light'], ['Phone top bar, wordmark', 'phone-wordmark-light'], ['Phone top bar, dark', 'phone-wordmark-dark'], ['Splash, light', 'splash-light'], ['Splash, dark', 'splash-dark']], 420),
  'before-after-phone.png',
);
await browser.close();
console.log('wrote', outDir);
