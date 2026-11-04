// Renders the audit mockups (heads, mail, disk) at 1920 wide, light and dark, variant D. Usage (anywhere): node render.cjs
const path = require('node:path');
const { chromium } = require(path.join(__dirname, '../../../../web/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const page of ['heads', 'mail', 'disk'])
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.goto(`file://${path.join(__dirname, page)}.html?v=D&theme=${theme}&device=desktop`);
      await p.waitForTimeout(200);
      await p.screenshot({ path: path.join(__dirname, `${page}--${theme}.jpg`), type: 'jpeg', quality: 82, fullPage: true });
      await ctx.close();
    }
  await browser.close();
})();
