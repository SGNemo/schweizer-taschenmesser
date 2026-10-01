#!/usr/bin/env node
/**
 * Renders every brand raster asset from the SVG sources in `brand/` (uses Playwright's Chromium, so
 * no image library is required). Run after changing a source: `npm run gen:icons`.
 *
 *   public/            icon.svg, favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png,
 *                      pwa-*.png, pwa-badge-96.png (monochrome web-push badge)
 *   src-tauri/icons/   icon.png + icon.ico (16–256, incl. 128) and the Android launcher layers
 *                      (foreground, monochrome, notification icon, background colour)
 *   docs/brand/        README header (light + dark) and social preview image
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
  const page = (w, h, body, { bg = OCEAN, fg = '#E7F1F2', muted = '#9FB6BC' } = {}) => `<style>
    @font-face{font-family:Inter;src:url(${interData});font-weight:100 900}
    html,body{margin:0}
    .bg{width:${w}px;height:${h}px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;color:${fg};font-family:Inter,sans-serif}
    .bg svg{height:${Math.round(h * 0.34)}px;width:auto}
    .tag{font-size:${Math.round(h * 0.055)}px;font-weight:500;letter-spacing:.01em;color:${muted}}
  </style><div class="bg">${body}</div>`;
  const tag = 'Modulare, lokale Alltags-App';
  // README header: a dark and a light version, picked by GitHub through <picture>.
  write(
    out(repo, 'docs', 'brand', 'header.png'),
    await pageShot(page(1280, 320, `${wordmarkLight}<div class="tag">${tag}</div>`), 1280, 320),
  );
  write(
    out(repo, 'docs', 'brand', 'header-light.png'),
    await pageShot(
      page(1280, 320, `${wordmark}<div class="tag">${tag}</div>`, {
        bg: LIGHT,
        fg: '#13262F',
        muted: '#51616A',
      }),
      1280,
      320,
    ),
  );
  write(
    out(repo, 'docs', 'brand', 'social-preview.png'),
    await pageShot(page(1280, 640, `${wordmarkLight}<div class="tag">${tag}</div>`), 1280, 640),
  );
} finally {
  await browser.close();
}
