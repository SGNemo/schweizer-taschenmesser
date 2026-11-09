/**
 * Renders the Identity 4.0 mockups (finanzen, todos, uebersicht) at 1920×1080 and 412×915, light and dark, into
 * web/.screens/ui-audit/mockups/ (gitignored; the images go to the branch shots/ui-audit-2026-11), plus
 * before/after sheets that put the audit screenshot of the same page next to the mockup.
 * Run from web/:  node ../docs/design/ui-audit-2026-11/mockups/render.mjs
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(process.cwd(), '.screens/ui-audit');
const out = path.join(shots, 'mockups');
mkdirSync(out, { recursive: true });
const PAGES = { finanzen: 'page-finance', todos: 'page-todos', uebersicht: 'overview-all' };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const files = [];
for (const [name, before] of Object.entries(PAGES))
  for (const device of ['desktop', 'mobile'])
    for (const theme of ['light', 'dark']) {
      const mobile = device === 'mobile';
      const ctx = await browser.newContext({ viewport: mobile ? { width: 412, height: 915 } : { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: mobile, colorScheme: theme });
      const page = await ctx.newPage();
      await page.goto(pathToFileURL(path.join(here, `${name}.html`)).href + `?theme=${theme}&device=${device}`);
      await page.waitForTimeout(200);
      const file = path.join(out, `${name}-${device}-${theme}.png`);
      await page.screenshot({ path: file });
      await ctx.close();
      const old = path.join(shots, `${mobile ? '412x915' : '1920x1080'}-${theme}/seed/${before}.png`);
      files.push({ name, device, theme, file, old: existsSync(old) ? old : null });
    }
// before/after sheets: one per page and device (light + dark rows)
for (const name of Object.keys(PAGES))
  for (const device of ['desktop', 'mobile']) {
    const rows = files.filter((f) => f.name === name && f.device === device);
    const w = device === 'mobile' ? 412 : 960;
    const html = `<!doctype html><html><body style="margin:0;padding:16px;background:#888;font:600 14px system-ui;color:#fff;display:grid;grid-template-columns:repeat(2,auto);gap:12px 16px;width:max-content">
      <div>heute (Audit-Lauf)</div><div>4.0 Mockup</div>
      ${rows.map((r) => `<img src="${r.old ? pathToFileURL(r.old).href : ''}" style="display:block;width:${w}px"><img src="${pathToFileURL(r.file).href}" style="display:block;width:${w}px">`).join('')}</body></html>`;
    const tmp = path.join(out, `sheet-${name}-${device}.html`);
    writeFileSync(tmp, html);
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(tmp).href);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `sheet-${name}-${device}.jpg`), fullPage: true, type: 'jpeg', quality: 80 });
    await ctx.close();
  }
await browser.close();
console.log('mockups in', out);
