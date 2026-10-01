// Banner compositions (README header light/dark, social preview) built from the wordmark concepts
// W2 (headfin) and W3 (ofish) plus the fish mark. Used for the banner round; the chosen variant is
// rendered into docs/brand by web/scripts/gen-icons.mjs.
//
//   node banners.mjs <round-dir>      reads <round-dir>/banners.mjs, writes PNGs + sheets next to it
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildWordmark } from './wordmark.mjs';
import { DEEP } from './final.params.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '../../web');
const { chromium } = createRequire(join(web, 'package.json'))('@playwright/test');
const executablePath = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const inter = `data:font/woff2;base64,${readFileSync(join(web, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64')}`;

const TAG = 'Modulare, lokale Alltags-App';
const tagHtml = (t, accent) => typeof t === 'string' ? t : t.parts.map(([a, b]) => `<b style="color:${accent};font-weight:700">${a}</b>${b}`).join(t.sep ?? ' · ');
const OCEAN = 'linear-gradient(135deg, #0B1D2B 0%, #0F3440 100%)';
const THEME = {
  dark: { bg: OCEAN, text: '#E7F1F2', muted: '#9FB6BC', deco: '#7FC4CC', decoAlpha: 0.09, wave: '#2B7A87', edge: '#14202B' },
  light: { bg: '#fbf8f3', text: '#13262F', muted: '#51616A', deco: DEEP, decoAlpha: 0.1, wave: DEEP, edge: '#14202B' },
};

// The mark (one fill, stripes and eye cut out) as a reusable symbol.
const markSrc = readFileSync(join(web, 'brand/logo-mark.svg'), 'utf8');
const markInner = markSrc
  .replace(/^[\s\S]*?<defs>/, '<defs>')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replaceAll('"#E0550F"', '"currentColor"');
const SYMBOL = `<svg width="0" height="0" style="position:absolute"><symbol id="fish" viewBox="51 93 393 344">${markInner}</symbol></svg>`;

// School of small fish in the free left/right thirds: [x, y, height, alpha factor] as fractions.
const SCHOOL = [
  [0.05, 0.22, 0.2, 1], [0.14, 0.7, 0.13, 0.8], [0.22, 0.4, 0.09, 0.6],
  [0.87, 0.2, 0.15, 0.9], [0.93, 0.66, 0.24, 1], [0.79, 0.8, 0.1, 0.7], [0.74, 0.3, 0.08, 0.6],
];
const BUBBLES = [[0.1, 0.3, 9], [0.13, 0.55, 5], [0.08, 0.75, 7], [0.9, 0.35, 8], [0.87, 0.6, 5], [0.93, 0.8, 10], [0.2, 0.2, 4], [0.78, 0.18, 4]];

function deco(v, t, w, h) {
  const c = THEME[t];
  let s = '';
  if (v.school) {
    for (const [x, y, hh, a] of SCHOOL) {
      const H = hh * h * (h > 400 ? 1.0 : 1);
      s += `<use href="#fish" x="${x * w - H * 0.57}" y="${y * h - H / 2}" width="${H * 1.142}" height="${H}" opacity="${(c.decoAlpha * a).toFixed(3)}" style="color:${c.deco}"/>`;
    }
  }
  if (v.bubbles) {
    for (const [x, y, r] of BUBBLES) {
      const R = r * (h / 320);
      s += `<circle cx="${x * w}" cy="${y * h}" r="${R}" fill="none" stroke="${c.deco}" stroke-width="2" opacity="${t === 'dark' ? 0.3 : 0.3}"/>`;
    }
  }
  if (v.bigfish) {
    const H = h * (h > 400 ? 0.82 : 1.0);
    s += `<use href="#fish" x="${w - H * 1.142 - w * 0.035}" y="${(h - H) / 2}" width="${H * 1.142}" height="${H}" opacity="${(c.decoAlpha * 1.1).toFixed(3)}" style="color:${c.deco}"/>`;
  }
  if (v.waves) {
    const y0 = h * 0.88;
    const wave = (dy, amp, a) => `<path d="M0 ${y0 + dy}C${w * 0.15} ${y0 + dy - amp} ${w * 0.3} ${y0 + dy - amp} ${w * 0.5} ${y0 + dy}S${w * 0.85} ${y0 + dy + amp} ${w} ${y0 + dy}V${h}H0Z" fill="${c.wave}" opacity="${a}"/>`;
    s += wave(0, h * 0.05, t === 'dark' ? 0.22 : 0.08) + wave(h * 0.07, h * 0.04, t === 'dark' ? 0.3 : 0.1);
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0">${s}</svg>`;
}

export function bannerHtml(v, t, w, h) {
  const c = THEME[t];
  const wm = buildWordmark(v.concept, { colors: { fish: DEEP, edge: c.edge, eye: c.edge } }, t);
  const wmH = Math.round(h * (v.wmScale ?? (v.concept === 'ofish' ? (h > 400 ? 0.52 : 0.6) : h > 400 ? 0.4 : 0.46)));
  const left = v.layout === 'left';
  return `<style>
    @font-face{font-family:Inter;src:url(${inter});font-weight:100 900}
    html,body{margin:0}
    .bg{position:relative;overflow:hidden;width:${w}px;height:${h}px;background:${c.bg};display:flex;flex-direction:column;
      align-items:${left ? 'flex-start' : 'center'};justify-content:center;gap:${Math.round(h * 0.085)}px;
      padding-left:${left ? Math.round(w * 0.09) : 0}px;box-sizing:border-box;font-family:Inter,sans-serif;color:${c.text}}
    .bg>svg.wm{position:relative;height:${wmH}px;width:auto}
    .tag{position:relative;font-size:${Math.round(h * 0.066)}px;font-weight:500;letter-spacing:.01em;color:${c.muted}}
  </style><div class="bg">${SYMBOL}${deco(v, t, w, h)}${wm.replace('<svg ', '<svg class="wm" ')}<div class="tag">${tagHtml(v.tag ?? TAG, DEEP)}</div></div>`;
}

export async function renderRound(dir) {
  const spec = (await import(pathToFileURL(join(dir, 'banners.mjs')).href)).default;
  const browser = await chromium.launch({ executablePath });
  const shot = async (html, w, h) => {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html);
    await p.evaluate('document.fonts.ready');
    const b = await p.screenshot({ type: 'png' });
    await p.close();
    return b;
  };
  const rows = [];
  for (const v of spec.variants) {
    const d = join(dir, v.label);
    mkdirSync(d, { recursive: true });
    const files = {
      header: await shot(bannerHtml(v, 'dark', 1280, 320), 1280, 320),
      headerLight: await shot(bannerHtml(v, 'light', 1280, 320), 1280, 320),
      social: await shot(bannerHtml(v, 'dark', 1280, 640), 1280, 640),
    };
    writeFileSync(join(d, 'header.png'), files.header);
    writeFileSync(join(d, 'header-light.png'), files.headerLight);
    writeFileSync(join(d, 'social-preview.png'), files.social);
    rows.push({ v, files });
  }
  const uri = (b) => `data:image/png;base64,${b.toString('base64')}`;
  const per = spec.perSheet ?? 2;
  for (let i = 0, n = 1; i < rows.length; i += per, n++) {
    const part = rows.slice(i, i + per);
    const html = `<style>body{margin:0;background:#e9ecee;font-family:Inter,sans-serif}.row{padding:18px 22px;border-bottom:1px solid #c9d0d4}
      h2{margin:0 0 4px;font:700 20px Inter,sans-serif;color:#13262F}p{margin:0 0 10px;font:14px Inter,sans-serif;color:#51616A}
      .g{display:flex;gap:14px}.c{display:flex;flex-direction:column;gap:10px}img{display:block;border-radius:6px;border:1px solid #c0c8cc}</style>
      <style>@font-face{font-family:Inter;src:url(${inter});font-weight:100 900}</style>
      ${part.map(({ v, files }) => `<div class="row"><h2>${v.label} · ${v.title}</h2><p>${v.desc}</p><div class="g">
        <div class="c"><img width="640" src="${uri(files.header)}"><img width="640" src="${uri(files.headerLight)}"></div>
        <img width="640" height="320" src="${uri(files.social)}"></div></div>`).join('')}`;
    const buf = await shot(html, 1340, part.length * 440 + 10);
    writeFileSync(join(dir, `sheet-${n}.png`), buf);
  }
  await browser.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? '');
  await renderRound(dir);
  console.log('banner round rendered in', dir);
}
