#!/usr/bin/env node
/**
 * Renders public/icon.svg into the PNG icons the PWA manifest needs (uses Playwright's Chromium,
 * so no image library is required). Run once after changing the icon: `npm run gen:icons`.
 * Set PW_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public', 'icon.svg'), 'utf8');
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// Maskable icons must keep content inside the central 80% "safe zone" and be full-bleed.
const maskableSvg = svg
  .replace('rx="112"', 'rx="0"')
  .replace(
    '<g fill="#fff">',
    '<g fill="#fff" transform="translate(256 256) scale(.78) translate(-256 -256)">',
  );

const targets = [
  ['pwa-192.png', 192, svg],
  ['pwa-512.png', 512, svg],
  ['pwa-maskable-512.png', 512, maskableSvg],
];

const browser = await chromium.launch({ executablePath });
try {
  for (const [file, size, source] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
    );
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    writeFileSync(join(root, 'public', file), png);
    await page.close();
    console.log(`wrote public/${file}`);
  }
} finally {
  await browser.close();
}
