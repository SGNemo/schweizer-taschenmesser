#!/usr/bin/env node
/**
 * Renders every brand raster asset from the SVG sources in `brand/` (uses Playwright's Chromium, so
 * no image library is required). Run after changing a source: `npm run gen:icons`.
 *
 *   public/            icon.svg, favicon.svg, favicon-32.png, apple-touch-icon.png, pwa-*.png
 *   src-tauri/icons/   icon.png + icon.ico (16–256, incl. 128) and the Android launcher layers
 *                      (foreground, monochrome, notification icon, background colour)
 *   docs/brand/        README header and social preview image
 *
 * The other native icons (Square*Logo, icon.icns, Android legacy mipmaps) come from the Tauri CLI:
 *   npx tauri icon brand/app-icon.svg      (then re-run this script: it restores icon.ico + Android layers)
 *
 * Set PW_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '..');
const brand = (name) => readFileSync(join(root, 'brand', name), 'utf8');
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const appIcon = brand('app-icon.svg');
const maskable = brand('app-icon-maskable.svg');
// Tiny sizes: the fish is enlarged and the corners are less round so it stays readable at 16–32 px.
const appIconSmall = appIcon.replace('scale(.72)', 'scale(.9)').replace('rx="112"', 'rx="96"');
const mark = brand('logo-mark.svg');
// Favicon: the fish alone, cropped to its bounding box, on a transparent tab.
const favicon = mark.replace('viewBox="0 0 512 512"', 'viewBox="24 96 456 304"');
const androidFg = brand('android-foreground.svg');
const androidMono = brand('android-monochrome.svg');
const mono = brand('logo-mono.svg');
const wordmarkLight = brand('logo-wordmark-light.svg');
const OCEAN = 'linear-gradient(135deg, #0B1D2B 0%, #0F3440 100%)';

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
  write(pub('apple-touch-icon.png'), await png(maskable, 180, 180, { transparent: false }));
  write(pub('pwa-192.png'), await png(appIcon, 192));
  write(pub('pwa-512.png'), await png(appIcon, 512));
  write(pub('pwa-maskable-512.png'), await png(maskable, 512));

  // ---- Windows / Tauri -------------------------------------------------------------------
  const icons = join(root, 'src-tauri', 'icons');
  write(out(icons, 'icon.png'), await png(appIcon, 512));
  const frames = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    frames.push({ size, data: await png(size <= 32 ? appIconSmall : appIcon, size) });
  }
  write(out(icons, 'icon.ico'), ico(frames));

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
    const notif = mono.replace('<g fill="#000"', '<g fill="#fff"');
    write(
      out(icons, 'android', `drawable-${name}`, 'ic_notification.png'),
      await png(notif, Math.round(24 * factor)),
    );
  }
  write(
    out(icons, 'android', 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#12384A</color>\n</resources>\n`,
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
  const inter = pathToFileURL(
    join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
  ).href;
  const page = (w, h, body) => `<style>
    @font-face{font-family:Inter;src:url(${inter});font-weight:100 900}
    html,body{margin:0}
    .bg{width:${w}px;height:${h}px;background:${OCEAN};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;color:#E7F1F2;font-family:Inter,sans-serif}
    .bg svg{height:${Math.round(h * 0.34)}px;width:auto}
    .tag{font-size:${Math.round(h * 0.055)}px;font-weight:500;letter-spacing:.01em;color:#9FB6BC}
  </style><div class="bg">${body}</div>`;
  const tag = 'Modulare, lokale Alltags-App';
  write(
    out(repo, 'docs', 'brand', 'header.png'),
    await pageShot(page(1280, 320, `${wordmarkLight}<div class="tag">${tag}</div>`), 1280, 320),
  );
  write(
    out(repo, 'docs', 'brand', 'social-preview.png'),
    await pageShot(page(1280, 640, `${wordmarkLight}<div class="tag">${tag}</div>`), 1280, 640),
  );
} finally {
  await browser.close();
}
