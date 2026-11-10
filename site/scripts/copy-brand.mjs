/**
 * Build step: copy logo, favicons, fonts and the social preview from their single sources in the
 * repository (web/brand, web/public, docs/brand, node_modules/@fontsource-variable/atkinson-hyperlegible-next) into
 * the site. The copies are git-ignored; nothing is drawn twice.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(site, '..');
const face = path.join(site, 'node_modules', '@fontsource-variable', 'atkinson-hyperlegible-next');

const copies = [
  ['web/brand/logo-mark.svg', 'src/assets/brand/logo-mark.svg'],
  ['web/brand/logo-mark.svg', 'public/brand/logo-mark.svg'],
  ['web/public/favicon.ico', 'public/favicon.ico'],
  ['web/public/favicon.svg', 'public/favicon.svg'],
  ['web/public/apple-touch-icon.png', 'public/apple-touch-icon.png'],
  ['docs/brand/social-preview.de.png', 'public/og-image.png'],
  [path.join(face, 'files', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'), 'public/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2'],
  [path.join(face, 'files', 'atkinson-hyperlegible-next-latin-ext-wght-normal.woff2'), 'public/fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2'],
  [path.join(face, 'LICENSE'), 'public/fonts/LICENSE-Atkinson-Hyperlegible-Next.txt'],
];

for (const [from, to] of copies) {
  const src = path.isAbsolute(from) ? from : path.join(repo, from);
  const dest = path.join(site, to);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}
console.log(`copy-brand: ${copies.length} files`);
