// Renders the identity v2 mockups: 5 pages × variants A/B/C × light/dark × desktop (1920×1080) / phone (412×915),
// plus the phone head collapsed and the Spotify "no active device" state. Single shots go to OUT (default:
// a temp folder), contact sheets to this folder. Usage: node render.cjs [outDir]
// Needs the web/ node_modules (playwright) and the pre-installed Chromium.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(__dirname, '../../../../web/node_modules/playwright'));
const OUT = process.argv[2] || path.join(require('node:os').tmpdir(), 'identity-v2');
fs.mkdirSync(OUT, { recursive: true });
const PAGES = ['uebersicht', 'wetter', 'spotify', 'finanzen', 'kalender'];
const EXTRA = [
  ['wetter', 'B', 'light', 'mobile', 'scrolled=1', 'wetter--B-light-mobile-scrolled'],
  ['spotify', 'B', 'light', 'desktop', 'state=nodevice', 'spotify--B-light-desktop-nodevice'],
  ['spotify', 'B', 'dark', 'desktop', 'state=nodevice', 'spotify--B-dark-desktop-nodevice'],
  ['spotify', 'B', 'light', 'mobile', 'state=nodevice', 'spotify--B-light-mobile-nodevice'],
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async (page, v, theme, device, extra, name) => {
    const ctx = await browser.newContext({
      viewport: device === 'mobile' ? { width: 412, height: 915 } : { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: device === 'mobile',
    });
    const p = await ctx.newPage();
    const q = `v=${v}&theme=${theme}&device=${device}${extra ? `&${extra}` : ''}`;
    await p.goto(`file://${path.join(__dirname, page)}.html?${q}`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await ctx.close();
  };
  for (const page of PAGES)
    for (const v of ['A', 'B', 'C'])
      for (const theme of ['light', 'dark'])
        for (const device of ['desktop', 'mobile'])
          await shot(page, v, theme, device, '', `${page}--${v}-${theme}-${device}`);
  for (const [page, v, theme, device, extra, name] of EXTRA) await shot(page, v, theme, device, extra, name);
  await browser.close();
  console.log('shots in', OUT);
})();
