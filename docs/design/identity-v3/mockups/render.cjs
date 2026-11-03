// Renders the identity v3 mockups: 6 pages × variants A/B/C × light/dark × desktop (1920×1080) / phone (412×915).
// Single shots go to OUT (default: a temp folder); contact sheets per variant (desktop light, desktop dark, phone)
// go to this folder. Usage: node render.cjs [outDir]. Needs web/node_modules (playwright) and the pre-installed Chromium.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(__dirname, '../../../../web/node_modules/playwright'));
const OUT = process.argv[2] || path.join(require('node:os').tmpdir(), 'identity-v3');
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ['uebersicht', 'kalender', 'todos', 'vorraete', 'finanzen', 'widgets'];
const ONLY = process.env.V ? process.env.V.split(',') : ['A', 'B', 'C'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async (page, v, theme, device) => {
    const ctx = await browser.newContext({
      viewport: device === 'mobile' ? { width: 412, height: 915 } : { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: device === 'mobile',
    });
    const p = await ctx.newPage();
    await p.goto(`file://${path.join(__dirname, page)}.html?v=${v}&theme=${theme}&device=${device}`);
    await p.waitForTimeout(150);
    const file = path.join(OUT, `${page}--${v}-${theme}-${device}.png`);
    await p.screenshot({ path: file });
    await ctx.close();
    return file;
  };
  const sheet = async (files, cols, scale, name) => {
    const html = `<!doctype html><html><body style="margin:0;padding:16px;background:#888;display:grid;grid-template-columns:repeat(${cols},auto);gap:16px;width:max-content">${files
      .map((f) => `<img src="file://${f}" style="display:block;width:${Math.round((f.includes('mobile') ? 412 : 1920) * scale)}px">`)
      .join('')}</body></html>`;
    // Written next to the shots: a file:// page may load file:// images, a setContent page may not.
    const tmp = path.join(OUT, `${name}.html`);
    fs.writeFileSync(tmp, html);
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(`file://${tmp}`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true });
    await ctx.close();
  };
  for (const v of ONLY) {
    const light = [], dark = [], mobile = [];
    for (const page of PAGES) {
      light.push(await shot(page, v, 'light', 'desktop'));
      dark.push(await shot(page, v, 'dark', 'desktop'));
      mobile.push(await shot(page, v, 'light', 'mobile'));
      mobile.push(await shot(page, v, 'dark', 'mobile'));
    }
    await sheet(light, 2, 0.5, `sheet--${v}-desktop-light`);
    await sheet(dark, 2, 0.5, `sheet--${v}-desktop-dark`);
    await sheet(mobile, 6, 0.75, `sheet--${v}-phone`);
  }
  await browser.close();
  console.log('shots in', OUT);
})();
