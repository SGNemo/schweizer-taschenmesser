// The shipped raster assets (not the SVG sources) in the places the hand tests check: Windows taskbar and
// tray, browser tab strips, PWA home screen (maskable in a circle), Android launcher masks, themed icon and
// the status-bar notification icon. A mock built from web/src-tauri/icons, web/public and the extension icons.
//
//   node tools/os-mock.mjs <out.png>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const web = resolve(import.meta.dirname, '../../../web');
const { chromium } = require(join(web, 'node_modules/@playwright/test'));
const out = resolve(process.argv[2] ?? 'os-mock.png');
const uri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const icons = join(web, 'src-tauri/icons');
const A = (n) => uri(join(icons, 'android', n));
const bgColor = readFileSync(join(icons, 'android/values/ic_launcher_background.xml'), 'utf8').match(/#[0-9a-fA-F]{6}/)[0];
const tile = uri(join(icons, 'icon.png'));
const tile32 = uri(join(icons, '32x32.png'));
const fav = uri(join(web, 'public/favicon-32.png'));
const pwa = uri(join(web, 'public/pwa-192.png'));
const maskable = uri(join(web, 'public/pwa-maskable-512.png'));
const fg = A('mipmap-xxxhdpi/ic_launcher_foreground.png');
const mono = A('mipmap-xxxhdpi/ic_launcher_monochrome.png');
const notif = A('drawable-xxxhdpi/ic_notification.png');

const taskbar = (dark, icon, px, slot) => {
  const bg = dark ? '#202020' : '#eef0f3';
  const ph = dark ? '#5f6670' : '#aab1ba';
  const cells = Array.from({ length: 7 }, (_, i) =>
    i === 3
      ? `<div class="slot" style="width:${slot}px;height:${slot}px"><div class="act" style="background:${dark ? '#2d2d2d' : '#fff'}"></div><img src="${icon}" style="position:relative;width:${px}px;height:${px}px"><div class="ul" style="background:${dark ? '#8ab4c8' : '#2f6f86'}"></div></div>`
      : `<div class="slot" style="width:${slot}px;height:${slot}px"><div style="width:${px * 0.9}px;height:${px * 0.9}px;border-radius:${i % 3 === 0 ? '50%' : '6px'};background:${ph}"></div></div>`,
  ).join('');
  return `<div class="bar" style="background:${bg};height:${slot}px">${cells}</div>`;
};
const tray = (dark) => `<div class="bar" style="background:${dark ? '#202020' : '#eef0f3'};height:40px;gap:14px;padding:0 14px"><img src="${tile32}" style="width:16px;height:16px"><img src="${tile}" style="width:24px;height:24px"><span style="color:${dark ? '#bbb' : '#555'};font-size:11px">16 / 24 px</span></div>`;
const tabs = (dark) => {
  const strip = dark ? '#202124' : '#dee1e6';
  const tab = dark ? '#35363a' : '#fff';
  const ink = dark ? '#e8eaed' : '#202124';
  return `<div class="tabs" style="background:${strip}"><div class="tab" style="background:${tab};color:${ink}"><img src="${fav}" style="width:16px;height:16px"> Nemo – Übersicht</div><div class="tab" style="color:${ink};opacity:.7"><img src="${fav}" style="width:16px;height:16px"> Nemo</div></div>`;
};
const adaptive = (shape, size) => {
  const k = size / 72; // the launcher shows the central 72 dp of the 108 dp layers
  const r = shape === 'circle' ? '50%' : shape === 'squircle' ? '34%' : '22%';
  return `<div class="mask" style="width:${size}px;height:${size}px;border-radius:${r};background:${bgColor}"><img src="${fg}" style="width:${108 * k}px;height:${108 * k}px;margin:${-18 * k}px 0 0 ${-18 * k}px"></div>`;
};
const themed = (bg, ink, size) => {
  const k = size / 72;
  return `<div class="mask" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg}"><div style="width:${108 * k}px;height:${108 * k}px;margin:${-18 * k}px 0 0 ${-18 * k}px;background:${ink};-webkit-mask:url(${mono}) center/100% 100%;mask:url(${mono}) center/100% 100%"></div></div>`;
};

const html = `<style>
  body{margin:0;padding:24px;width:1260px;background:#e9ebee;font:13px Inter,system-ui,sans-serif;color:#1f2933}
  h3{font-size:12px;margin:0 0 8px;color:#4b5563;text-transform:uppercase;letter-spacing:.04em}
  .row{display:flex;gap:36px;align-items:flex-start;margin-bottom:26px}
  .bar{display:flex;align-items:center;border-radius:6px;margin-bottom:8px}
  .slot{display:grid;place-items:center;position:relative}
  .act{position:absolute;inset:4px 6px;border-radius:4px}
  .ul{position:absolute;left:36%;right:36%;bottom:2px;height:3px;border-radius:2px}
  .tabs{display:flex;gap:4px;padding:6px 8px 0;border-radius:8px 8px 0 0;width:380px;margin-bottom:8px}
  .tab{display:flex;gap:8px;align-items:center;height:32px;padding:0 12px;border-radius:8px 8px 0 0;font-size:12px;min-width:140px}
  .wall{display:flex;gap:18px;padding:16px 18px;border-radius:12px;margin-bottom:8px;align-items:center}
  .mask{overflow:hidden;flex:none}
  .mask img{display:block}
  .note{display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:14px;background:#2b2f33;color:#e8eaed;width:340px}
  .dot{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:${bgColor}}
  .home{display:flex;gap:22px;padding:16px 18px;border-radius:12px;background:#1b2a33;align-items:center}
</style>
<div class="row"><div><h3>Windows-Taskleiste 100 % (24 px) · 150 % (36 px)</h3>${taskbar(true, tile32, 24, 48)}${taskbar(false, tile32, 24, 48)}${taskbar(true, tile, 36, 72)}</div>
<div><h3>Tray 16 / 24 px</h3>${tray(true)}${tray(false)}<h3 style="margin-top:18px">Favicon im Tab (16 px)</h3>${tabs(false)}${tabs(true)}</div></div>
<div class="row"><div><h3>Android-Launcher: Kreis · Squircle · abgerundet</h3>
<div class="wall" style="background:#1b2a33">${['circle', 'squircle', 'rounded'].map((s) => adaptive(s, 84)).join('')}${themed('#1e3a41', '#b7e3ec', 84)}</div>
<div class="wall" style="background:#dfe6ea">${['circle', 'squircle', 'rounded'].map((s) => adaptive(s, 84)).join('')}${themed('#cde7ec', '#0f4c5c', 84)}</div></div>
<div><h3>PWA: Start-Symbol (maskable im Kreis) · Statusleiste</h3>
<div class="home"><div class="mask" style="width:96px;height:96px;border-radius:50%"><img src="${maskable}" style="width:96px;height:96px"></div><img src="${pwa}" style="width:96px;height:96px;border-radius:22px"></div>
<div class="note" style="margin-top:12px"><div class="dot"><img src="${notif}" style="width:16px;height:16px"></div><div><b>Nemo</b><br>Erinnerung: Rechnung fällig</div></div></div></div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1320, height: 700 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
