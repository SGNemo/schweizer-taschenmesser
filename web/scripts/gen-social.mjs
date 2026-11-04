#!/usr/bin/env node
/**
 * Renders the GitHub social preview (1280×640 PNG, English and German) from the current logo and the
 * README overview screenshot. Upload `docs/brand/social-preview.png` under Settings → General →
 * Social preview (the maintainer does that by hand).
 *
 *   npm run gen:social
 *
 * Needs `docs/assets/screenshots/overview-desktop-dark.webp` (`npm run app:screenshots -- --readme`
 * in site/). The README header pictures and the icons still come from `npm run gen:icons`.
 * Set PW_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '..');
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const shotFile = join(repo, 'docs', 'assets', 'screenshots', 'overview-desktop-dark.webp');
if (!existsSync(shotFile)) {
  console.error(`Missing ${shotFile}: run \`npm run app:screenshots -- --readme\` in site/ first.`);
  process.exit(1);
}

/** The wordmark files keep the sidebar's box; for banners the view box is cut to the pill (the first rect). */
const pillOnly = (svg) => {
  const [, x, y, w, h] = svg.match(
    /<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/,
  );
  return svg.replace(/viewBox="[^"]+"/, `viewBox="${x} ${y} ${w} ${h}"`);
};
const wordmark = pillOnly(readFileSync(join(root, 'brand', 'logo-wordmark-light.svg'), 'utf8'));
const data = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const inter = data(
  join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'),
  'font/woff2',
);
const shot = data(shotFile, 'image/webp');

const TEXT = {
  en: {
    file: 'social-preview.png',
    claim: 'Calendar, to-dos, money and passwords.',
    sub: 'Your data stays on your device.',
    alt: 'Windows · Android · PWA',
  },
  de: {
    file: 'social-preview.de.png',
    claim: 'Kalender, ToDos, Geld und Passwörter.',
    sub: 'Deine Daten bleiben auf deinem Gerät.',
    alt: 'Windows · Android · PWA',
  },
};

const page = (t) => `<style>
  @font-face{font-family:Inter;src:url(${inter});font-weight:100 900}
  html,body{margin:0}
  .bg{position:relative;overflow:hidden;width:1280px;height:640px;color:#E7F1F2;font-family:Inter,sans-serif;
    background:linear-gradient(135deg,#0B1D2B 0%,#0F3440 100%)}
  .text{position:absolute;left:72px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:34px}
  .text svg{display:block;width:420px;height:auto}
  .claim{font-size:40px;font-weight:650;line-height:1.2;letter-spacing:-.01em}
  .sub{font-size:26px;font-weight:450;line-height:1.35;color:#9FB6BC;margin-top:-18px}
  .alt{font-size:20px;font-weight:550;color:#7FC4CC;letter-spacing:.02em}
  .frame{position:absolute;left:590px;top:96px;width:780px;height:439px;border-radius:16px;overflow:hidden;
    box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08)}
  .frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:left top}
</style>
<div class="bg">
  <div class="text">${wordmark}<div class="claim">${t.claim}</div><div class="sub">${t.sub}</div><div class="alt">${t.alt}</div></div>
  <div class="frame"><img src="${shot}" alt=""></div>
</div>`;

const browser = await chromium.launch({ executablePath });
try {
  for (const t of Object.values(TEXT)) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 640 } });
    await p.setContent(page(t));
    await p.evaluate('document.fonts.ready');
    await p.waitForFunction(() => [...document.images].every((i) => i.complete));
    const out = join(repo, 'docs', 'brand', t.file);
    writeFileSync(out, await p.screenshot({ type: 'png' }));
    console.log(`wrote docs/brand/${t.file}`);
    await p.close();
  }
} finally {
  await browser.close();
}
