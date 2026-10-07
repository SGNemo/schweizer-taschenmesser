#!/usr/bin/env node
/**
 * Renders every brand raster asset from the SVG sources in `brand/` (uses Playwright's Chromium, so
 * no image library is required). Run after changing a source: `npm run gen:icons`.
 *
 *   public/            icon.svg, favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png,
 *                      pwa-*.png, pwa-badge-96.png (monochrome web-push badge)
 *   src-tauri/icons/   icon.png + icon.ico (16–256, incl. 128) and the Android launcher layers
 *                      (foreground, monochrome, notification icon, background colour)
 *   docs/brand/        README header (light + dark) and social preview image, English + German `*.de.png`
 *
 * The other native icons (icon.icns, Android legacy mipmaps) come from the Tauri CLI:
 *   npx tauri icon brand/app-icon.svg      (then re-run this script: it restores icon.ico + Android
 *   layers and removes the iOS / appx sets no target uses)
 *
 * Set PW_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '..');
const brand = (name) => readFileSync(join(root, 'brand', name), 'utf8');
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const appIcon = brand('app-icon.svg');
const maskable = brand('app-icon-maskable.svg');
// Tiny sizes: the corners are less round so the tile keeps its area at 16–32 px.
const appIconSmall = appIcon.replace('rx="112"', 'rx="96"');
const mark = brand('logo-mark.svg');
// Favicon: the fish alone on a transparent tab, in a square frame around its bounding box.
const [vx, vy, vw, vh] = mark
  .match(/viewBox="([^"]+)"/)[1]
  .split(' ')
  .map(Number);
const side = Math.round(Math.max(vw, vh) * 1.06);
const favicon = mark.replace(
  /viewBox="[^"]+"/,
  `viewBox="${Math.round(vx + vw / 2 - side / 2)} ${Math.round(vy + vh / 2 - side / 2)} ${side} ${side}"`,
);
const androidFg = brand('android-foreground.svg');
const androidMono = brand('android-monochrome.svg');
const mono = brand('logo-mono.svg');
const monoWhite = mono.replace('fill="#000" stroke="#000"', 'fill="#fff" stroke="#fff"');
const wordmark = brand('logo-wordmark.svg');
const wordmarkLight = brand('logo-wordmark-light.svg');
const OCEAN = 'linear-gradient(135deg, #0B1D2B 0%, #0F3440 100%)';
const LIGHT = '#fbf8f3';
/* Inter as a data URL: Chromium blocks file:// fonts on about:blank pages (setContent). */
const interData = `data:font/woff2;base64,${readFileSync(
  join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
).toString('base64')}`;

const out = (...p) => {
  const file = join(...p);
  mkdirSync(dirname(file), { recursive: true });
  return file;
};

const browser = await chromium.launch({ executablePath });
async function png(svg, w, h = w, { transparent = true } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`,
  );
  const buf = await page.screenshot({ omitBackground: transparent, type: 'png' });
  await page.close();
  return buf;
}
async function pageShot(html, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html);
  await page.evaluate('document.fonts.ready');
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return buf;
}
const write = (file, data) => {
  writeFileSync(file, data);
  console.log(`wrote ${file.replace(`${repo}/`, '')}`);
};

/** PNG-in-ICO container (Windows Vista+ accepts PNG frames for every size). */
function ico(frames) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const dir = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...frames.map((f) => f.data)]);
}

try {
  // ---- Web / PWA -------------------------------------------------------------------------
  const pub = (name) => out(root, 'public', name);
  write(pub('icon.svg'), appIcon);
  write(pub('favicon.svg'), favicon);
  write(pub('favicon-32.png'), await png(favicon, 32));
  const faviconFrames = [];
  for (const size of [16, 32, 48]) faviconFrames.push({ size, data: await png(favicon, size) });
  write(pub('favicon.ico'), ico(faviconFrames));
  write(pub('apple-touch-icon.png'), await png(maskable, 180, 180, { transparent: false }));
  write(pub('pwa-192.png'), await png(appIcon, 192));
  write(pub('pwa-512.png'), await png(appIcon, 512));
  write(pub('pwa-maskable-512.png'), await png(maskable, 512));
  // Web push badge (Android status bar): white silhouette on transparent.
  write(pub('pwa-badge-96.png'), await png(monoWhite, 96));

  // ---- Windows / Tauri -------------------------------------------------------------------
  const icons = join(root, 'src-tauri', 'icons');
  write(out(icons, 'icon.png'), await png(appIcon, 512));
  const frames = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    frames.push({ size, data: await png(size <= 32 ? appIconSmall : appIcon, size) });
  }
  write(out(icons, 'icon.ico'), ico(frames));
  // `tauri icon` also writes iOS and appx (Square*Logo, StoreLogo) sets; no target of this app uses them.
  for (const name of readdirSync(icons)) {
    if (name === 'ios' || /^Square\d+x\d+Logo\.png$|^StoreLogo\.png$/.test(name)) {
      rmSync(join(icons, name), { recursive: true, force: true });
      console.log(`removed src-tauri/icons/${name}`);
    }
  }

  // ---- Android layers (108 dp canvas; the launcher mask keeps the central 66 dp) ------------
  const density = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [name, factor] of Object.entries(density)) {
    const layer = Math.round(108 * factor);
    write(
      out(icons, 'android', `mipmap-${name}`, 'ic_launcher_foreground.png'),
      await png(androidFg, layer),
    );
    write(
      out(icons, 'android', `mipmap-${name}`, 'ic_launcher_monochrome.png'),
      await png(androidMono, layer),
    );
    // Status-bar icon: white silhouette on transparent, 24 dp.
    write(
      out(icons, 'android', `drawable-${name}`, 'ic_notification.png'),
      await png(monoWhite, Math.round(24 * factor)),
    );
  }
  write(
    out(icons, 'android', 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#E0550F</color>\n</resources>\n`,
  );
  write(
    out(icons, 'android', 'mipmap-anydpi-v26', 'ic_launcher.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <background android:drawable="@color/ic_launcher_background"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`,
  );

  // ---- README header + social preview -----------------------------------------------------
  // Composition "H1" (design/icon/rounds/13): wordmark centred, a faint school of small marks in
  // the free thirds, the claim (backronym of NEMO) with orange initials. README/social only.
  // English for the repo (README.md, social preview); German copies `*.de.png` for README.de.md.
  const CLAIMS = {
    en: [
      ['N', 'otes'],
      ['E', 'vents'],
      ['M', 'odules'],
      ['O', 'ffline'],
    ],
    de: [
      ['N', 'otizen'],
      ['E', 'rinnerungen'],
      ['M', 'odule'],
      ['O', 'ffline'],
    ],
  };
  const markSymbol = `<svg width="0" height="0" style="position:absolute"><symbol id="fish" viewBox="51 93 393 344">${mark
    .replace(/^[\s\S]*?<defs>/, '<defs>')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replaceAll('"#E0550F"', '"currentColor"')}</symbol></svg>`;
  const SCHOOL = [
    [0.05, 0.22, 0.2, 1],
    [0.14, 0.7, 0.13, 0.8],
    [0.22, 0.4, 0.09, 0.6],
    [0.87, 0.2, 0.15, 0.9],
    [0.93, 0.66, 0.24, 1],
    [0.79, 0.8, 0.1, 0.7],
    [0.74, 0.3, 0.08, 0.6],
  ];
  const school = (w, h, color, alpha) =>
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0">${SCHOOL.map(
      ([x, y, hh, a]) => {
        const H = hh * h;
        return `<use href="#fish" x="${x * w - H * 0.57}" y="${y * h - H / 2}" width="${H * 1.142}" height="${H}" opacity="${(alpha * a).toFixed(3)}" style="color:${color}"/>`;
      },
    ).join('')}</svg>`;
  const page = (
    w,
    h,
    wm,
    claim,
    { bg = OCEAN, fg = '#E7F1F2', muted = '#9FB6BC', deco = '#7FC4CC', alpha = 0.09 } = {},
  ) => `<style>
    @font-face{font-family:Inter;src:url(${interData});font-weight:100 900}
    html,body{margin:0}
    .bg{position:relative;overflow:hidden;width:${w}px;height:${h}px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h * 0.085)}px;color:${fg};font-family:Inter,sans-serif}
    .bg>svg.wm{position:relative;height:${Math.round(h * 0.56)}px;width:auto}
    .tag{position:relative;font-size:${Math.round(h * 0.066)}px;font-weight:500;letter-spacing:.01em;color:${muted}}
    .tag b{color:#E0550F;font-weight:700}
  </style><div class="bg">${markSymbol}${school(w, h, deco, alpha)}${wm.replace('<svg ', '<svg class="wm" ')}<div class="tag">${claim
    .map(([a, b]) => `<b>${a}</b>${b}`)
    .join(' · ')}</div></div>`;
  // README header: a dark and a light version, picked by GitHub through <picture>.
  for (const [lang, claim] of Object.entries(CLAIMS)) {
    const suffix = lang === 'en' ? '' : `.${lang}`;
    write(
      out(repo, 'docs', 'brand', `header${suffix}.png`),
      await pageShot(page(1280, 320, wordmarkLight, claim), 1280, 320),
    );
    write(
      out(repo, 'docs', 'brand', `header-light${suffix}.png`),
      await pageShot(
        page(1280, 320, wordmark, claim, {
          bg: LIGHT,
          fg: '#13262F',
          muted: '#51616A',
          deco: '#E0550F',
          alpha: 0.1,
        }),
        1280,
        320,
      ),
    );
    write(
      out(repo, 'docs', 'brand', `social-preview${suffix}.png`),
      await pageShot(page(1280, 640, wordmarkLight, claim), 1280, 640),
    );
  }
} finally {
  await browser.close();
}
