// Renders the audit mockups (heads, mail, disk) at 1920 wide, light and dark, variant D. Usage (anywhere): node render.cjs.
// Output: web/.screens/identity-v3-audit-mockups/ (gitignored; images do not go into docs/, DOCS-GUIDE.md "Images").
const path = require('node:path');
const { chromium } = require(path.join(__dirname, '../../../../web/node_modules/playwright'));
const OUT = path.join(__dirname, '../../../../web/.screens/identity-v3-audit-mockups');
require('node:fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const page of ['heads', 'mail', 'disk'])
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.goto(`file://${path.join(__dirname, page)}.html?v=D&theme=${theme}&device=desktop`);
      await p.waitForTimeout(200);
      await p.screenshot({ path: path.join(OUT, `${page}--${theme}.jpg`), type: 'jpeg', quality: 82, fullPage: true });
      await ctx.close();
    }
  await browser.close();
})();
