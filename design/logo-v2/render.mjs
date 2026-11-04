// Renders one round: every variant's SVG layers plus one preview sheet (PNG) – sizes 16–512 on
// light and dark, one-colour, true-pixel zooms, the mark montaged into the real shell (sidebar
// wide and rail, phone top bar), Windows taskbar and tray, Android masks + safe zone + themed
// icon, favicon tab, lockups and the palette check. Chromium (Playwright from web/) rasterises.
//
//   node render.mjs rounds/<n>        reads rounds/<n>/variants.mjs, writes rounds/<n>/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildLayers, COLORS, merge, reach } from './mark.mjs';
import { lockupSvg } from './wordmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const require = createRequire(import.meta.url);
const { chromium } = require(join(repo, 'web/node_modules/@playwright/test'));
const dir = resolve(here, process.argv[2] ?? 'rounds/1');
const round = dir.split('/').at(-1);
const spec = (await import(pathToFileURL(join(dir, 'variants.mjs')).href)).default;
const ctx = join(here, 'context');
const boxes = JSON.parse(readFileSync(join(ctx, 'boxes.json'), 'utf8'));

const b64 = (s) => Buffer.from(s).toString('base64');
const svgUri = (s) => `data:image/svg+xml;base64,${b64(s)}`;
const pngUri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const fileUri = (name) => pngUri(readFileSync(join(ctx, name)));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const r1 = (n) => Math.round(n * 10) / 10;

// ---------- rasteriser (true pixels at a given size) ----------
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const rpage = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
const rasterCache = new Map();
async function raster(svg, w, h = w) {
  const key = `${w}x${h}:${svg}`;
  if (rasterCache.has(key)) return rasterCache.get(key);
  await rpage.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${w}px;height:${h}px}</style><img src="${svgUri(svg)}">`,
  );
  const buf = await rpage.locator('img').screenshot({ omitBackground: true, type: 'png' });
  rasterCache.set(key, buf);
  return buf;
}

// ---------- HTML pieces ----------
const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; width: 2400px; background: #e9ebee; font: 14px/1.4 Inter, system-ui, sans-serif; color: #1f2933; }
  h1 { font-size: 34px; margin: 0 0 4px; font-weight: 700; }
  h2 { font-size: 26px; margin: 0; font-weight: 700; display: flex; gap: 14px; align-items: baseline; }
  h2 .lbl { font-size: 40px; }
  h3 { font-size: 13px; font-weight: 600; margin: 0 0 6px; color: #4b5563; text-transform: uppercase; letter-spacing: .04em; }
  p { margin: 4px 0 0; max-width: 1500px; }
  .sub { color: #4b5563; font-size: 16px; }
  .sheet { padding: 28px 24px 40px; }
  .block { background: #f7f8fa; border-radius: 14px; padding: 20px 24px 24px; margin-top: 22px; }
  .row { display: flex; gap: 18px; align-items: flex-start; margin-top: 16px; flex-wrap: wrap; }
  .row > div { flex: none; }
  .panel { border-radius: 10px; padding: 14px 16px 10px; }
  .light { background: #ffffff; color: #1f2933; }
  .dark { background: #0f1316; color: #cbd2d9; }
  .surface-dark { background: #171c20; }
  .sizes { display: flex; align-items: flex-end; gap: 22px; }
  .sizes div { text-align: center; font-size: 12px; color: #6b7280; }
  .dark .sizes div { color: #9aa5b1; }
  .sizes img { display: block; margin: 0 auto 6px; }
  img { display: block; }
  .px { image-rendering: pixelated; }
  .cap { font-size: 12px; color: #6b7280; margin-top: 6px; }
  .dark .cap { color: #9aa5b1; }
  .notes { font-size: 14px; color: #374151; margin-top: 14px; }
  ul { margin: 6px 0 0 18px; padding: 0; }
  li { margin: 2px 0; }
  .montage { position: relative; display: inline-block; line-height: 0; border-radius: 8px; overflow: hidden; }
  .montage .over { position: absolute; }
  .taskbar { display: flex; align-items: center; gap: 0; height: 48px; padding: 0 8px; border-radius: 6px; }
  .taskbar .slot { width: 48px; height: 48px; display: grid; place-items: center; position: relative; }
  .taskbar .ph { width: 22px; height: 22px; border-radius: 6px; }
  .taskbar .active { position: absolute; left: 6px; top: 4px; right: 6px; bottom: 4px; border-radius: 4px; }
  .taskbar .pill { position: absolute; left: 16px; right: 16px; bottom: 2px; height: 3px; border-radius: 2px; }
  .tray { display: flex; align-items: center; gap: 14px; height: 48px; padding: 0 14px; border-radius: 6px; }
  .wall { display: flex; gap: 22px; align-items: flex-start; padding: 16px 18px 12px; border-radius: 12px; }
  .wall div { text-align: center; font-size: 11px; }
  .wall img { margin: 0 auto 6px; }
  .tabs { display: flex; align-items: flex-end; gap: 4px; height: 40px; padding: 6px 8px 0; border-radius: 8px 8px 0 0; width: 420px; }
  .tab { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 8px 8px 0 0; font-size: 12px; min-width: 150px; }
  .hues { display: flex; gap: 10px; align-items: center; }
  .hues div { text-align: center; font-size: 10px; color: #6b7280; }
  .dark .hues div { color: #9aa5b1; }
  .word { display: flex; gap: 18px; align-items: center; }
`;
const img = (svg, w, h = w, cls = '') => `<img class="${cls}" src="${svgUri(svg)}" style="width:${w}px;height:${h}px">`;
const pix = (buf, size, zoom) => `<img class="px" src="${pngUri(buf)}" style="width:${size * zoom}px;height:${size * zoom}px">`;
const sizesRow = (svgOf, sizes, cls) =>
  `<div class="sizes">${sizes.map((s) => `<div>${img(svgOf(s), s)}${s}</div>`).join('')}</div>`;

// Android adaptive composition (108 dp canvas, masks like the launcher) and the themed icon.
const MASKS = {
  circle: '<circle cx="54" cy="54" r="36"/>',
  squircle: squirclePath(),
  rounded: '<rect x="18" y="18" width="72" height="72" rx="16"/>',
};
function squirclePath() {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([54 + 36 * Math.sign(c) * Math.abs(c) ** 0.4, 54 + 36 * Math.sign(s) * Math.abs(s) ** 0.4]);
  }
  return `<path d="M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z"/>`;
}
const adaptive = (bg, fg, mask) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><defs><clipPath id="m">${MASKS[mask]}</clipPath></defs><g clip-path="url(#m)"><image width="108" height="108" href="${svgUri(bg)}"/><image width="108" height="108" href="${svgUri(fg)}"/></g></svg>`;
const safeZone = (bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><image width="108" height="108" href="${svgUri(bg)}"/><image width="108" height="108" href="${svgUri(fg)}"/>` +
  `<path fill="#000" fill-opacity=".45" fill-rule="evenodd" d="M0 0H108V108H0ZM18 18V90H90V18Z"/><rect x="18" y="18" width="72" height="72" fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="2 1.5"/>` +
  `<circle cx="54" cy="54" r="33" fill="none" stroke="#FFD84D" stroke-width=".8" stroke-dasharray="2 1.5"/></svg>`;
const tint = (mono, color) => mono.replace(/#ffffff|#000000/gi, color);
const themed = (adMono, bg, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><defs><clipPath id="m">${MASKS.circle}</clipPath></defs><g clip-path="url(#m)"><rect width="108" height="108" fill="${bg}"/><image width="108" height="108" href="${svgUri(tint(adMono, ink))}"/></g></svg>`;

function taskbar(appSvg, dark, scale) {
  const bg = dark ? '#202020' : '#eef0f3';
  const ph = dark ? '#5f6670' : '#aab1ba';
  const slot = 48 * scale;
  const icon = 24 * scale;
  let s = `<div class="taskbar" style="background:${bg};height:${slot}px">`;
  for (let i = 0; i < 7; i++) {
    s += `<div class="slot" style="width:${slot}px;height:${slot}px">`;
    if (i === 3) {
      s += `<div class="active" style="background:${dark ? '#2d2d2d' : '#ffffff'}"></div>`;
      s += `<div style="position:relative">${img(appSvg, icon)}</div>`;
      s += `<div class="pill" style="background:${dark ? '#8ab4c8' : '#2f6f86'}"></div>`;
    } else {
      const r = i % 3 === 0 ? '50%' : i % 3 === 1 ? '6px' : '3px';
      s += `<div class="ph" style="background:${ph};border-radius:${r};width:${22 * scale}px;height:${22 * scale}px"></div>`;
    }
    s += `</div>`;
  }
  return s + `</div>`;
}
function tray(L, dark) {
  const bg = dark ? '#202020' : '#eef0f3';
  const ink = dark ? '#ffffff' : '#000000';
  return (
    `<div class="tray" style="background:${bg}">` +
    img(L.appSmall, 16) +
    img(tint(L.mono, ink), 16) +
    img(L.markSquare, 16) +
    `<span style="width:1px;height:20px;background:${dark ? '#444' : '#ccc'}"></span>` +
    img(L.app, 24) +
    img(tint(L.mono, ink), 24) +
    `<span style="font-size:11px;color:${dark ? '#bbb' : '#555'}">16 / 24</span></div>`
  );
}
function favTabs(L, dark) {
  const strip = dark ? '#202124' : '#dee1e6';
  const tab = dark ? '#35363a' : '#ffffff';
  const idle = dark ? '#2b2c2f' : '#e8eaed';
  const ink = dark ? '#e8eaed' : '#202124';
  const t = (svg, title, active) =>
    `<div class="tab" style="background:${active ? tab : idle};color:${ink};opacity:${active ? 1 : 0.8}">${img(svg, 16)}<span>${title}</span></div>`;
  return `<div class="tabs" style="background:${strip}">${t(L.app, 'Nemo – Übersicht', true)}${t(L.markSquare, 'Nemo', false)}<div class="tab" style="background:${idle};min-width:60px;color:${ink}">…</div></div>`;
}

/** The candidate montaged into a real shell screenshot (2x crop shown at 2x = 200 % zoom, or 1x). */
function montage(name, w, h, overlays, dpr) {
  const src = fileUri(`${name}.png`);
  let s = `<div class="montage" style="width:${w}px;height:${h}px"><img src="${src}" style="width:${420 * dpr}px;height:${240 * dpr}px">`;
  for (const o of overlays) s += `<img class="over" src="${svgUri(o.svg)}" style="left:${o.x}px;top:${o.y}px;height:${o.h}px;width:auto">`;
  return s + `</div>`;
}
function phoneMontage(name, markSvg) {
  const b = boxes[name].brand; // 12,12,44,44 at 1x; the mark 32 px centred
  const size = 32;
  return `<div class="montage" style="width:824px;height:140px"><img src="${fileUri(`${name}.png`)}" style="width:824px;height:140px"><img class="over" src="${svgUri(markSvg)}" style="left:${(b.x + (b.width - size) / 2) * 2}px;top:${(b.y + (b.height - size) / 2) * 2}px;height:${size * 2}px;width:auto"></div>`;
}

// ---------- blocks ----------
function header() {
  return `<h1>Nemo logo v2 · round ${round} · ${esc(spec.title)}</h1><p class="sub">${esc(spec.subtitle ?? '')}</p>`;
}

const DARK_INK = { mark: COLORS.accent.dark, mono: '#ffffff' };

async function variantBlock(v) {
  const L = buildLayers(v.params, { ink: v.ink });
  const Ld = buildLayers(v.params, { ink: { ...DARK_INK, ...(v.inkDark ?? {}) } });
  const Ls = v.small ? buildLayers(merge(v.params, v.small), { ink: v.ink }) : L;
  const Lsd = v.small ? buildLayers(merge(v.params, v.small), { ink: { ...DARK_INK, ...(v.inkDark ?? {}) } }) : Ld;
  const appAt = (s) => (s <= 24 ? Ls.appSmall : s <= 32 ? Ls.app : L.app);
  const markAt = (s, dark) => (s <= 24 ? (dark ? Lsd : Ls).markSquare : (dark ? Ld : L).markSquare);
  const monoAt = (s, dark) => (s <= 24 ? (dark ? Lsd : Ls).mono : (dark ? Ld : L).mono);
  const SZ = [16, 24, 32, 48, 64, 128, 256];
  const MZ = [16, 24, 32, 48, 64, 128];
  let s = `<div class="block"><h2><span class="lbl">${v.label}</span> ${esc(v.title)}</h2><p>${esc(v.desc)}</p>`;
  // Sizes
  s += `<div class="row"><div class="panel light"><h3>App icon 16–256 · light</h3>${sizesRow(appAt, SZ)}</div><div class="panel dark"><h3>App icon · dark</h3>${sizesRow(appAt, SZ)}</div><div class="panel light"><h3>512</h3>${sizesRow(appAt, [512])}</div></div>`;
  s += `<div class="row"><div class="panel light"><h3>Mark 16–128 · light</h3>${sizesRow((z) => markAt(z, false), MZ)}</div><div class="panel dark"><h3>Mark · dark (accent #ff9a57)</h3>${sizesRow((z) => markAt(z, true), MZ)}</div>`;
  s += `<div class="panel light"><h3>One colour · light</h3>${sizesRow((z) => monoAt(z, false), [16, 24, 32, 64])}</div><div class="panel dark"><h3>One colour · dark</h3>${sizesRow((z) => monoAt(z, true), [16, 24, 32, 64])}</div></div>`;
  // True pixels
  const px = async (svg, size, zoom) => pix(await raster(svg, size), size, zoom);
  if (!v.compact) {
    s += `<div class="row"><div class="panel light"><h3>True pixels: tile 16 ×8 · 24 ×5 · 32 ×4 — mark 16 ×8 · 24 ×5</h3><div class="sizes">` +
      `<div>${await px(appAt(16), 16, 8)}16</div><div>${await px(appAt(24), 24, 5)}24</div><div>${await px(appAt(32), 32, 4)}32</div>` +
      `<div style="width:12px"></div><div>${await px(markAt(16, false), 16, 8)}16</div><div>${await px(markAt(24, false), 24, 5)}24</div></div></div>`;
    s += `<div class="panel dark"><h3>Dark</h3><div class="sizes">` +
      `<div>${await px(appAt(16), 16, 8)}16</div><div>${await px(appAt(24), 24, 5)}24</div><div>${await px(appAt(32), 32, 4)}32</div>` +
      `<div style="width:12px"></div><div>${await px(markAt(16, true), 16, 8)}16</div><div>${await px(markAt(24, true), 24, 5)}24</div><div>${await px(monoAt(16, true), 16, 8)}mono 16</div></div></div></div>`;
  }
  // Lockups (the word setting of this round; a variant may bring its own)
  const word = spec.lockupWord ?? { text: 'NEMO', weight: 700 };
  const lopts = v.lockup ?? spec.lockup ?? { source: 'mark', markHeight: 1.2, gap: 0.42 };
  const lk = (theme, wd, opts) => lockupSvg(theme === 'dark' ? Ld : L, wd, opts, theme);
  const lkL = lk('light', word, lopts);
  const lkD = lk('dark', word, lopts);
  const hL = (l, h) => img(l.svg, (h * l.width) / l.height, h);
  const lockH = spec.lockupHeight ?? 32;
  s += `<div class="row"><div class="panel light"><h3>Lockup · sidebar ${lockH} px, 28 px, 24 px</h3><div class="word">${hL(lkL, lockH)}${hL(lkL, 28)}${hL(lkL, 24)}</div></div>`;
  s += `<div class="panel dark"><h3>Dark</h3><div class="word">${hL(lkD, lockH)}${hL(lkD, 28)}${hL(lkD, 24)}</div></div>`;
  s += `<div class="panel light"><h3>Lockup large</h3>${hL(lkL, 96)}</div></div>`;
  // In the shell (2x = 200 % zoom)
  const railMark = (dark) => (v.rail === 'app' ? (dark ? Ld : L).app : (dark ? Ld : L).markSquare);
  const wideBox = boxes['desktop-light-wide-2x'].img; // 16,16,150,44 (CSS px)
  const railBox = boxes['desktop-light-rail-2x'].brand; // 8,12,59,28
  const railH = 28;
  const wideOver = (theme) => [
    { svg: (theme === 'dark' ? lkD : lkL).svg, x: wideBox.x * 2, y: (wideBox.y + (wideBox.height - lockH) / 2) * 2, h: lockH * 2 },
  ];
  const railOver = (theme) => [
    { svg: railMark(theme === 'dark'), x: (railBox.x + (railBox.width - railH) / 2) * 2, y: railBox.y * 2, h: railH * 2 },
  ];
  s += `<div class="row">`;
  s += `<div>${montage('desktop-light-wide-2x', 560, 360, wideOver('light'), 2)}<div class="cap">Sidebar wide, light (200 %) – lockup ${lockH} px</div></div>`;
  s += `<div>${montage('desktop-dark-wide-2x', 560, 360, wideOver('dark'), 2)}<div class="cap">Sidebar wide, dark</div></div>`;
  s += `<div>${montage('desktop-light-rail-2x', 560, 360, railOver('light'), 2)}<div class="cap">Rail, light – mark only 28 px</div></div>`;
  s += `<div>${montage('desktop-dark-rail-2x', 560, 360, railOver('dark'), 2)}<div class="cap">Rail, dark</div></div>`;
  s += `</div>`;
  const out = join(dir, v.label);
  mkdirSync(out, { recursive: true });
  const writeFiles = () => {
    const files = {
      'app-icon.svg': L.app,
      'logo-mark.svg': L.mark,
      'logo-mark-dark.svg': Ld.mark,
      'logo-mono.svg': L.mono,
      'android-foreground.svg': L.adFg,
      'android-background.svg': L.adBg,
      'android-monochrome.svg': L.adMono,
      'lockup-light.svg': lkL.svg,
      'lockup-dark.svg': lkD.svg,
    };
    for (const [n, t] of Object.entries(files)) writeFileSync(join(out, n), t);
    writeFileSync(join(out, 'params.json'), JSON.stringify({ params: v.params, ink: v.ink ?? null, small: v.small ?? null, lockup: lopts, rail: v.rail }, null, 2) + '\n');
  };
  if (v.compact) {
    writeFiles();
    return s + `<div class="notes"><b>Notes:</b> ${esc(v.notes ?? '')}</div></div>`;
  }
  // In the shell (1:1) + phone
  const wide1 = (theme) => [{ svg: (theme === 'dark' ? lkD : lkL).svg, x: wideBox.x, y: wideBox.y + (wideBox.height - lockH) / 2, h: lockH }];
  const rail1 = (theme) => [{ svg: railMark(theme === 'dark'), x: railBox.x + (railBox.width - railH) / 2, y: railBox.y, h: railH }];
  const crop1 = (name, over) => `<div class="montage" style="width:420px;height:120px"><img src="${fileUri(`${name}.png`)}" style="width:420px;height:240px">${over.map((o) => `<img class="over" src="${svgUri(o.svg)}" style="left:${o.x}px;top:${o.y}px;height:${o.h}px;width:auto">`).join('')}</div>`;
  s += `<div class="row"><div>${crop1('desktop-light-wide-1x', wide1('light'))}<div class="cap">1:1 light wide</div></div><div>${crop1('desktop-dark-wide-1x', wide1('dark'))}<div class="cap">1:1 dark wide</div></div><div>${crop1('desktop-light-rail-1x', rail1('light'))}<div class="cap">1:1 light rail</div></div><div>${crop1('desktop-dark-rail-1x', rail1('dark'))}<div class="cap">1:1 dark rail</div></div></div>`;
  const phoneMark = (dark) => (v.rail === 'app' ? (dark ? Ld : L).app : (dark ? Ld : L).markSquare);
  s += `<div class="row"><div>${phoneMontage('phone-light-2x', phoneMark(false))}<div class="cap">Phone top bar, light (200 %) – mark 32 px</div></div><div>${phoneMontage('phone-dark-2x', phoneMark(true))}<div class="cap">Phone top bar, dark</div></div></div>`;
  // OS contexts
  const safe = reach(L.box, L.views.adaptive.scale, L.views.adaptive.dx, L.views.adaptive.dy);
  s += `<div class="row"><div><h3>Windows taskbar 100 % (24 px) dark / light · 150 % (36 px)</h3>${taskbar(appAt(24), true, 1)}<div style="height:6px"></div>${taskbar(appAt(24), false, 1)}<div style="height:6px"></div>${taskbar(L.app, true, 1.5)}</div>`;
  s += `<div><h3>Tray: tile 16 · mono 16 · mark 16 | tile 24 · mono 24</h3>${tray(L, true)}<div style="height:6px"></div>${tray(L, false)}</div>`;
  s += `<div><h3>Android launcher: circle · squircle · rounded (56 px) · themed</h3>`;
  for (const [wall, bgc, ink, dark] of [
    ['#1b2a33', '#1e3a41', '#b7e3ec', true],
    ['#dfe6ea', '#cde7ec', '#0f4c5c', false],
  ]) {
    s += `<div class="wall" style="background:${wall};color:${dark ? '#c9d2d8' : '#3b4650'}">`;
    for (const m of ['circle', 'squircle', 'rounded']) s += `<div>${img(adaptive(L.adBg, L.adFg, m), 56)}${m}</div>`;
    s += `<div>${img(themed(L.adMono, bgc, ink), 56)}themed</div><div>${img(adaptive(L.adBg, L.adFg, 'circle'), 36)}36</div></div>`;
  }
  s += `</div><div><h3>Safe zone (66 dp yellow) · reach ${r1(safe)} / 156</h3>${img(safeZone(L.adBg, L.adFg), 160)}<div class="cap">${safe <= 156.4 ? 'inside the safe zone' : 'OUTSIDE the safe zone – scale down'}</div></div>`;
  s += `<div><h3>Favicon in a tab (16 px): tile · mark</h3>${favTabs(L, false)}<div style="height:8px"></div>${favTabs(L, true)}</div></div>`;
  // Palette check
  const hues = Object.entries(COLORS.mod);
  s += `<div class="row"><div class="panel light"><h3>Palette check · light: accent, then the ten module hues (32 px)</h3><div class="hues"><div>${img(L.markIn(COLORS.accent.light), 32)}accent</div>${hues.map(([n, [l]]) => `<div>${img(L.markIn(l), 32)}${n}</div>`).join('')}</div></div>`;
  s += `<div class="panel dark"><h3>Dark</h3><div class="hues"><div>${img(L.markIn(COLORS.accent.dark), 32)}accent</div>${hues.map(([n, [, d]]) => `<div>${img(L.markIn(d), 32)}${n}</div>`).join('')}</div></div></div>`;
  s += `<div class="notes"><b>Notes:</b> ${esc(v.notes ?? '')}</div></div>`;
  writeFiles();
  return s;
}

async function wordmarkBlock() {
  const base = spec.variants.find((x) => x.label === spec.wordmarkBase) ?? spec.variants[0];
  const L = buildLayers(base.params, { ink: base.ink });
  const Ld = buildLayers(base.params, { ink: { ...DARK_INK, ...(base.inkDark ?? {}) } });
  const lockH = spec.lockupHeight ?? 32;
  const wideBox = boxes['desktop-light-wide-2x'].img;
  let s = `<div class="block"><h2>Wordmarks (shown with ${esc(base.label)})</h2><p>${esc(spec.wordmarkIntro ?? '')}</p>`;
  for (const w of spec.wordmarks ?? []) {
    const opts = w.lockup ?? { source: 'none' };
    const mk = (LL, theme) => lockupSvg(LL, w.word, opts, theme);
    const l = mk(L, 'light');
    const d = mk(Ld, 'dark');
    const h = (x, hh) => img(x.svg, (hh * x.width) / x.height, hh);
    const hh0 = w.height ?? lockH; // a wordmark may ask for its own height in the sidebar head
    const over = (x) => [{ svg: x.svg, x: wideBox.x * 2, y: (wideBox.y + (wideBox.height - hh0) / 2) * 2, h: hh0 * 2 }];
    const pxl = async (x, hh, zoom) => {
      const ww = Math.round((hh * x.width) / x.height);
      return `<img class="px" src="${pngUri(await raster(x.svg, ww, hh))}" style="width:${ww * zoom}px;height:${hh * zoom}px">`;
    };
    s += `<div class="row" style="align-items:center"><div style="width:300px"><b style="font-size:22px">${w.label}</b><br>${esc(w.title)}</div><div class="panel light">${h(l, hh0)}</div><div class="panel dark">${h(d, hh0)}</div><div class="panel light">${h(l, 28)}</div><div class="panel light">${h(l, 100)}</div></div>`;
    s += `<div class="row" style="align-items:center"><div style="width:300px" class="cap">True pixels: ${hh0} px ×4 · 28 px ×4 (light) · 28 px ×4 (dark)</div><div class="panel light">${await pxl(l, hh0, 4)}</div><div class="panel light">${await pxl(l, 28, 4)}</div><div class="panel dark">${await pxl(d, 28, 4)}</div></div>`;
    s += `<div class="row"><div>${montage('desktop-light-wide-2x', 560, 360, over(l), 2)}<div class="cap">${w.label} in the sidebar, light (200 %) – ${hh0} px</div></div><div>${montage('desktop-dark-wide-2x', 560, 360, over(d), 2)}<div class="cap">${w.label} dark</div></div>` +
      `<div><div class="montage" style="width:420px;height:120px"><img src="${fileUri('desktop-light-wide-1x.png')}" style="width:420px;height:240px"><img class="over" src="${svgUri(l.svg)}" style="left:${wideBox.x}px;top:${wideBox.y + (wideBox.height - hh0) / 2}px;height:${hh0}px;width:auto"></div><div class="cap">1:1 light</div>` +
      `<div class="montage" style="width:420px;height:120px;margin-top:8px"><img src="${fileUri('desktop-dark-wide-1x.png')}" style="width:420px;height:240px"><img class="over" src="${svgUri(d.svg)}" style="left:${wideBox.x}px;top:${wideBox.y + (wideBox.height - hh0) / 2}px;height:${hh0}px;width:auto"></div><div class="cap">1:1 dark</div></div></div>`;
    if (w.notes) s += `<div class="notes"><b>Notes:</b> ${esc(w.notes)}</div>`;
    const out = join(dir, w.label);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'lockup-light.svg'), l.svg);
    writeFileSync(join(out, 'lockup-dark.svg'), d.svg);
    writeFileSync(join(out, 'params.json'), JSON.stringify({ word: w.word, lockup: opts }, null, 2) + '\n');
  }
  return s + `</div>`;
}

// ---------- compose ----------
let html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="sheet">${header()}`;
for (const v of spec.variants) html += await variantBlock(v);
if (spec.wordmarks?.length) html += await wordmarkBlock();
html += `</div>`;
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const page = await browser.newPage({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: join(dir, 'sheet.png'), fullPage: true });
await browser.close();
console.log(`round ${round}: ${spec.variants.length} variants -> ${join(dir, 'sheet.png')}`);
