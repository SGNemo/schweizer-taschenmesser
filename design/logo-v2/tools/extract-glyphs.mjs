// Extracts the letter outlines of "Nemo" / "nemo" from the Inter static fonts (OFL, the app's
// typeface) into glyphs-inter.json, so the wordmark SVGs contain paths and no font.
//
//   npm i opentype.js@1.3.4 && node tools/extract-glyphs.mjs [fontDir]
//
// Output units: 1000 per em, y down (SVG), baseline at y = 0. Per family/weight: cap height,
// x-height, and per letter the path + advance; kerning pairs for the two words.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const here = dirname(fileURLToPath(import.meta.url));
const fontDir = process.argv[2] ?? '/usr/share/fonts/opentype/inter';
const FAMILIES = { inter: 'Inter', display: 'InterDisplay' };
const WEIGHTS = { 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
const LETTERS = ['N', 'n', 'e', 'm', 'o'];
const PAIRS = [['N', 'e'], ['n', 'e'], ['e', 'm'], ['m', 'o']];

const out = { unitsPerEm: 1000, families: {} };
for (const [key, file] of Object.entries(FAMILIES)) {
  out.families[key] = {};
  for (const [w, name] of Object.entries(WEIGHTS)) {
    const font = opentype.loadSync(join(fontDir, `${file}-${name}.otf`));
    const k = 1000 / font.unitsPerEm;
    const r = (n) => Math.round(n * k * 10) / 10;
    const letters = {};
    for (const ch of LETTERS) {
      const g = font.charToGlyph(ch);
      // getPath at size 1000 gives y down already (SVG convention).
      const p = g.getPath(0, 0, 1000);
      letters[ch] = { d: p.toPathData(1), advance: r(g.advanceWidth) };
    }
    const kern = {};
    for (const [a, b] of PAIRS) {
      const v = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
      if (v) kern[a + b] = r(v);
    }
    out.families[key][w] = {
      font: `${font.names.fontFamily.en} ${font.names.fontSubfamily.en} ${font.names.version.en}`,
      capHeight: r(font.tables.os2.sCapHeight),
      xHeight: r(font.tables.os2.sxHeight),
      letters,
      kern,
    };
  }
}
writeFileSync(join(here, '..', 'glyphs-inter.json'), JSON.stringify(out) + '\n');
console.log('wrote glyphs-inter.json');
