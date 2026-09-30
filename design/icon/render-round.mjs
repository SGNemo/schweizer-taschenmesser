// Renders one design round: writes every variant's SVG layers and one preview
// sheet (PNG) with all sizes, light/dark, Windows taskbar + tray, Android
// adaptive masks (+ safe zone) and the monochrome/themed variants.
//
//   node render-round.mjs <N>      reads rounds/<N>/variants.mjs, writes rounds/<N>/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildLayers, squirclePath } from './fish.mjs';
import { buildWordmark } from './wordmark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const round = process.argv[2];
if (!round) throw new Error('usage: node render-round.mjs <round>');
const dir = join(here, 'rounds', round);
const spec = (await import(pathToFileURL(join(dir, 'variants.mjs')).href)).default;

const FONT = { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' };
const png = (s, size) => new Resvg(s, { fitTo: { mode: 'width', value: size }, font: FONT }).render().asPng();
const b64 = (buf) => Buffer.from(buf).toString('base64');
const pngUri = (buf) => `data:image/png;base64,${b64(buf)}`;
const svgUri = (s) => `data:image/svg+xml;base64,${b64(s)}`;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (buf, x, y, w, h = w, pixel = false) =>
  `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${pngUri(buf)}"${pixel ? ' image-rendering="optimizeSpeed"' : ''}/>`;
const text = (x, y, t, size = 15, fill = '#3b434b', weight = 'normal', anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(t)}</text>`;

/** Recolour a one-colour SVG (ink is the element that carries fill="#000" + mask). */
const tint = (s, color) => s.replace(/fill="#(?:000|fff)"(\s+mask=)/gi, `fill="${color}"$1`);

// ---------- layers per variant ----------
function layersOf(v) {
  if (v.files) {
    const read = (p) => (p.startsWith('#') ? p : readFileSync(join(repo, p), 'utf8'));
    const f = Object.fromEntries(Object.entries(v.files).map(([k, p]) => [k, read(p)]));
    if (f.adBg.startsWith('#'))
      f.adBg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${f.adBg}"/></svg>`;
    return f;
  }
  return buildLayers(v.params);
}

// ---------- Android adaptive ----------
const MASKS = {
  circle: '<circle cx="54" cy="54" r="36"/>',
  rounded: '<rect x="18" y="18" width="72" height="72" rx="16"/>',
  squircle: `<path transform="translate(18 18)" d="${squirclePath(72, 5)}"/>`,
};
const adaptive = (bg, fg, mask) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><defs><clipPath id="m">${MASKS[mask]}</clipPath></defs>` +
  `<g clip-path="url(#m)"><image width="108" height="108" href="${svgUri(bg)}"/><image width="108" height="108" href="${svgUri(fg)}"/></g></svg>`;
const safeZone = (bg, fg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><image width="108" height="108" href="${svgUri(bg)}"/><image width="108" height="108" href="${svgUri(fg)}"/>` +
  `<path fill="#000" fill-opacity=".5" fill-rule="evenodd" d="M0 0H108V108H0ZM18 18V90H90V18Z"/>` +
  `<rect x="18" y="18" width="72" height="72" fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="2 1.5"/>` +
  `<circle cx="54" cy="54" r="33" fill="none" stroke="#FFD84D" stroke-width=".7" stroke-dasharray="2 1.5"/></svg>`;
const themed = (mono, bgc, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><defs><clipPath id="m">${MASKS.circle}</clipPath></defs><g clip-path="url(#m)">` +
  `<rect width="108" height="108" fill="${bgc}"/><image width="108" height="108" href="${svgUri(tint(mono, ink))}"/></g></svg>`;

// ---------- sheet ----------
const W = 2600;
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const LIGHT = '#FFFFFF';
const DARK = '#121417';

function sizesPanel(L, x, y, bg, fg) {
  let s = `<rect x="${x}" y="${y}" width="1270" height="570" rx="10" fill="${bg}"/>`;
  let cx = x + 20;
  const base = y + 20 + 512;
  for (const size of SIZES) {
    s += img(png(L.full, size), cx, base - size, size);
    s += text(cx + size / 2, base + 26, `${size}`, 14, fg, 'normal', 'middle');
    cx += size + 22;
  }
  return s;
}

function taskbar(L, x, y, dark, scale) {
  const slot = 48 * scale;
  const icon = 24 * scale;
  const n = 7;
  const bg = dark ? '#1F1F1F' : '#EEF0F3';
  const glyph = dark ? '#6B7178' : '#A3A9B0';
  let s = `<rect x="${x}" y="${y}" width="${slot * n}" height="${slot}" fill="${bg}"/>`;
  for (let i = 0; i < n; i++) {
    const gx = x + i * slot + (slot - icon) / 2;
    const gy = y + (slot - icon) / 2;
    if (i === 4) {
      s += `<rect x="${x + i * slot + 4 * scale}" y="${y + 4 * scale}" width="${slot - 8 * scale}" height="${slot - 8 * scale}" rx="${4 * scale}" fill="${dark ? '#2D2D2D' : '#FFFFFF'}"/>`;
      s += img(png(L.full, icon), gx, gy, icon);
      s += `<rect x="${x + i * slot + slot / 2 - 8 * scale}" y="${y + slot - 5 * scale}" width="${16 * scale}" height="${3 * scale}" rx="${1.5 * scale}" fill="${dark ? '#8AB4C8' : '#2F6F86'}"/>`;
    } else {
      // Neutral placeholder glyphs (no real app icons).
      const shapes = [
        `<rect x="${gx}" y="${gy}" width="${icon}" height="${icon}" rx="${5 * scale}" fill="${glyph}"/>`,
        `<circle cx="${gx + icon / 2}" cy="${gy + icon / 2}" r="${icon / 2}" fill="${glyph}"/>`,
        `<rect x="${gx + 2 * scale}" y="${gy + 3 * scale}" width="${icon - 4 * scale}" height="${icon - 6 * scale}" rx="${2 * scale}" fill="${glyph}"/>`,
      ];
      s += shapes[i % 3];
    }
  }
  return s;
}

function tray(L, x, y, dark) {
  const bg = dark ? '#1F1F1F' : '#EEF0F3';
  const ink = dark ? '#FFFFFF' : '#000000';
  let s = `<rect x="${x}" y="${y}" width="230" height="44" fill="${bg}"/>`;
  s += img(png(L.full, 16), x + 14, y + 14, 16);
  s += img(png(tint(L.mono, ink), 16), x + 46, y + 14, 16);
  s += img(png(L.full, 24), x + 92, y + 10, 24);
  s += img(png(tint(L.mono, ink), 24), x + 132, y + 10, 24);
  s += img(png(tint(L.mono, ink), 24 * 1.5), x + 176, y + 4, 36);
  return s;
}

function block(v, y) {
  const L = layersOf(v);
  let s = `<rect x="0" y="${y}" width="${W}" height="1010" fill="#E4E7EB"/>`;
  s += text(24, y + 40, v.label, 34, '#0E2F45', 'bold');
  s += text(40 + v.label.length * 26, y + 38, v.title, 24, '#0E2F45', 'bold');
  s += text(24, y + 68, v.desc, 16, '#3b434b');
  const y1 = y + 84;
  s += sizesPanel(L, 20, y1, LIGHT, '#555');
  s += sizesPanel(L, 1310, y1, DARK, '#aaa');

  const y2 = y1 + 590;
  const lab = (x, t) => text(x, y2 - 6 + 0, t, 14, '#3b434b');
  // Zoomed small sizes (nearest neighbour) to judge real pixels.
  s += lab(20, '16 px ×8 / 24 px ×5 (echte Pixel)');
  const z16 = png(L.full, 16);
  const z24 = png(L.full, 24);
  s += `<rect x="20" y="${y2 + 4}" width="136" height="136" fill="${LIGHT}"/>` + img(z16, 24, y2 + 8, 128, 128, true);
  s += `<rect x="166" y="${y2 + 4}" width="136" height="136" fill="${DARK}"/>` + img(z16, 170, y2 + 8, 128, 128, true);
  s += `<rect x="20" y="${y2 + 150}" width="136" height="136" fill="${LIGHT}"/>` + img(z24, 28, y2 + 154, 120, 120, true);
  s += `<rect x="166" y="${y2 + 150}" width="136" height="136" fill="${DARK}"/>` + img(z24, 174, y2 + 154, 120, 120, true);

  // Windows taskbar (100 % and 150 %).
  s += lab(340, 'Windows-Taskleiste 100 % (24 px) dunkel/hell, 150 % (36 px)');
  s += taskbar(L, 340, y2 + 4, true, 1);
  s += taskbar(L, 340, y2 + 62, false, 1);
  s += taskbar(L, 340, y2 + 120, true, 1.5);
  // Tray (colour vs. one colour).
  s += lab(880, 'Tray: Farbe 16 | einfarbig 16 | Farbe 24 | einfarbig 24, 36');
  s += tray(L, 880, y2 + 4, true);
  s += tray(L, 880, y2 + 58, false);

  // Android adaptive masks on dark and light wallpaper.
  const ax = 1400;
  s += lab(ax, 'Android adaptiv: Kreis | abgerundet | Squircle');
  for (const [row, wall] of [
    [0, '#23313A'],
    [1, '#E6ECEF'],
  ]) {
    const yy = y2 + 4 + row * 142;
    s += `<rect x="${ax}" y="${yy}" width="396" height="136" rx="8" fill="${wall}"/>`;
    ['circle', 'rounded', 'squircle'].forEach((m, i) => {
      s += img(png(adaptive(L.adBg, L.adFg, m), 108), ax + 18 + i * 126, yy + 14, 108);
    });
  }
  s += lab(1830, 'Safe-Zone (gelb 66 dp)');
  s += img(png(safeZone(L.adBg, L.adFg), 216), 1830, y2 + 4, 216);

  // Monochrome: Android themed icon (light/dark) + plain one-colour mark.
  s += lab(2080, 'Themed (hell/dunkel) | einfarbig');
  s += `<rect x="2080" y="${y2 + 4}" width="136" height="136" rx="8" fill="#F1F4F5"/>` + img(png(themed(L.adMono, '#CDE7EC', '#0F4C5C'), 108), 2094, y2 + 18, 108);
  s += `<rect x="2226" y="${y2 + 4}" width="136" height="136" rx="8" fill="#101416"/>` + img(png(themed(L.adMono, '#1E3A41', '#B7E3EC'), 108), 2240, y2 + 18, 108);
  s += `<rect x="2372" y="${y2 + 4}" width="136" height="136" rx="8" fill="${LIGHT}"/>` + img(png(L.mono, 108), 2386, y2 + 18, 108);
  s += `<rect x="2080" y="${y2 + 150}" width="136" height="136" rx="8" fill="${LIGHT}"/>` + img(png(L.mark, 108), 2094, y2 + 164, 108);
  s += `<rect x="2226" y="${y2 + 150}" width="136" height="136" rx="8" fill="${DARK}"/>` + img(png(L.mark, 108), 2240, y2 + 164, 108);
  s += text(2372, y2 + 190, 'Logo ohne Plättchen', 14, '#3b434b');
  s += text(2372, y2 + 210, '(hell / dunkel)', 14, '#3b434b');
  return { svg: s, layers: L };
}

// ---------- wordmarks ----------
const raster = (s, mode, value) => {
  const r = new Resvg(s, { fitTo: { mode, value }, font: FONT }).render();
  return { buf: r.asPng(), w: r.width, h: r.height };
};
const placeFit = (s, x, y, w, h) => {
  const byH = raster(s, 'height', h);
  const r = byH.w <= w ? byH : raster(s, 'width', w);
  return img(r.buf, Math.round(x + (w - r.w) / 2), Math.round(y + (h - r.h) / 2), r.w, r.h);
};
const WM_H = 500;
function wordmarkBlock(v, y) {
  const light = buildWordmark(v.concept, v.params, 'light');
  const dark = buildWordmark(v.concept, v.params, 'dark');
  let s = `<rect x="0" y="${y}" width="${W}" height="${WM_H - 20}" fill="#E4E7EB"/>`;
  s += text(24, y + 40, v.label, 34, '#0E2F45', 'bold');
  s += text(40 + v.label.length * 26, y + 38, v.title, 24, '#0E2F45', 'bold');
  s += text(24, y + 68, v.desc, 16, '#3b434b');
  const y1 = y + 84;
  s += `<rect x="20" y="${y1}" width="600" height="180" rx="10" fill="${LIGHT}"/>` + placeFit(light, 40, y1 + 20, 560, 140);
  s += `<rect x="640" y="${y1}" width="600" height="180" rx="10" fill="${DARK}"/>` + placeFit(dark, 660, y1 + 20, 560, 140);
  // README header (640 x 160 like docs/brand), dark ocean and light.
  for (const [i, bg, wm, tag] of [
    [0, 'url(#ocean)', dark, '#9FB6BC'],
    [1, '#FBF8F3', light, '#51616A'],
  ]) {
    const hx = 1270 + i * 660;
    s += `<rect x="${hx}" y="${y1 + 10}" width="640" height="160" fill="${bg}"/>` + placeFit(wm, hx + 120, y1 + 30, 400, 78);
    s += text(hx + 320, y1 + 140, 'Modulare, lokale Alltags-App', 13, tag, 'normal', 'middle');
  }
  s += text(1270, y1 + 4, 'README-Header 640×160 (dunkel / hell)', 14, '#3b434b');
  // Sidebar at real size (22 px like <Logo size={22}/>) and 3x zoom.
  const y2 = y1 + 200;
  s += text(20, y2 + 14, 'Sidebar in echter Grösse (Höhe 22 px) dunkel / hell, rechts 3× vergrössert', 14, '#3b434b');
  const side = (x, bg, wm, zoom) => {
    const r = raster(wm, 'height', 22);
    const w = 240;
    let o = `<rect x="${x}" y="${y2 + 24}" width="${w * zoom}" height="${48 * zoom}" fill="${bg}"/>`;
    return o + img(r.buf, x + 16 * zoom, y2 + 24 + 13 * zoom, r.w * zoom, r.h * zoom, zoom > 1);
  };
  s += side(20, '#15181C', dark, 1) + side(280, '#FFFFFF', light, 1);
  s += side(560, '#15181C', dark, 3) + side(1300, '#FFFFFF', light, 3);
  return { svg: s, light, dark };
}

const variants = spec.variants ?? [];
const wordmarks = spec.wordmarks ?? [];
const H = 120 + variants.length * 1030 + (wordmarks.length ? 70 + wordmarks.length * WM_H : 0);
let body = `<defs><linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1D2B"/><stop offset="1" stop-color="#0F3440"/></linearGradient></defs>`;
body += `<rect width="${W}" height="${H}" fill="#F3F4F6"/>`;
body += text(24, 56, `Nemo App-Icon · Runde ${round}${spec.title ? ' · ' + spec.title : ''}`, 36, '#0E2F45', 'bold');
body += text(24, 92, spec.subtitle ?? '', 18, '#3b434b');
variants.forEach((v, i) => {
  const { svg, layers } = block(v, 120 + i * 1030);
  body += svg;
  const out = join(dir, v.label);
  mkdirSync(out, { recursive: true });
  for (const k of ['full', 'mark', 'mono', 'adFg', 'adBg', 'adMono']) {
    const name = { full: 'app-icon', mark: 'logo-mark', mono: 'logo-mono', adFg: 'android-foreground', adBg: 'android-background', adMono: 'android-monochrome' }[k];
    writeFileSync(join(out, `${name}.svg`), layers[k]);
  }
  if (layers.params) writeFileSync(join(out, 'params.json'), JSON.stringify(v.params, null, 2) + '\n');
});
if (wordmarks.length) {
  const y0 = 120 + variants.length * 1030;
  body += text(24, y0 + 48, 'Wortmarken: „Nemo“ wird selbst zum Fisch', 30, '#0E2F45', 'bold');
  wordmarks.forEach((v, i) => {
    const { svg, light, dark } = wordmarkBlock(v, y0 + 70 + i * WM_H);
    body += svg;
    const out = join(dir, v.label);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'logo-wordmark.svg'), light);
    writeFileSync(join(out, 'logo-wordmark-light.svg'), dark);
    writeFileSync(join(out, 'params.json'), JSON.stringify({ concept: v.concept, params: v.params ?? {} }, null, 2) + '\n');
  });
}
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
writeFileSync(join(dir, 'sheet.png'), new Resvg(sheet, { font: FONT }).render().asPng());
console.log(`round ${round}: ${variants.length} icon variants, ${wordmarks.length} wordmarks -> ${join(dir, 'sheet.png')}`);
