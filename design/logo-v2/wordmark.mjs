// Wordmark "Nemo" / "nemo" set in Inter (the app's typeface) from the outlines in glyphs-inter.json
// (tools/extract-glyphs.mjs), plus the lockup mark + word. Units: 1000 per em, baseline y = 0.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, merge } from './mark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const GLYPHS = JSON.parse(readFileSync(join(here, 'glyphs-inter.json'), 'utf8'));

export const WORD_DEFAULTS = {
  text: 'Nemo',
  family: 'inter', // inter | display (Inter Display: tighter, for large sizes)
  weight: 600, // 500 | 600 | 700 | 800
  tracking: -0.01, // em, added between letters
};

const r1 = (n) => Math.round(n * 10) / 10;
/** Shift an absolute M/L/C/Q/Z path by dx (x coordinates only). */
function shiftPath(d, dx) {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => {
    const v = Number(m);
    const isX = i % 2 === 0;
    i += 1;
    return isX ? String(r1(v + dx)) : m;
  });
}

/** The word as one path: { d, width, capHeight, xHeight, font }. */
export function wordPath(input = {}) {
  const p = merge(WORD_DEFAULTS, input);
  const fam = GLYPHS.families[p.family];
  if (!fam) throw new Error(`unknown family ${p.family}`);
  const face = fam[p.weight];
  if (!face) throw new Error(`weight ${p.weight} missing for ${p.family}`);
  const letters = [...p.text];
  let x = 0;
  const parts = [];
  let firstBearing = null;
  letters.forEach((ch, i) => {
    const g = face.letters[ch];
    if (!g) throw new Error(`no outline for "${ch}"`);
    if (firstBearing === null) firstBearing = leftEdge(g.d);
    parts.push(shiftPath(g.d, x));
    const pair = ch + (letters[i + 1] ?? '');
    x += g.advance + (face.kern[pair] ?? 0) + (i < letters.length - 1 ? p.tracking * 1000 : 0);
  });
  // Trim the right side bearing of the last letter so the box is tight on both sides.
  const last = face.letters[letters.at(-1)];
  const lastRight = last.advance - rightEdge(last.d);
  return { d: parts.join(''), width: r1(x - lastRight - firstBearing), left: firstBearing, capHeight: face.capHeight, xHeight: face.xHeight, font: face.font, params: p };
}
function leftEdge(d) {
  let min = Infinity;
  let i = 0;
  for (const m of d.matchAll(/-?\d*\.?\d+/g)) {
    if (i % 2 === 0) min = Math.min(min, Number(m[0]));
    i += 1;
  }
  return min;
}
function rightEdge(d) {
  let max = -Infinity;
  let i = 0;
  for (const m of d.matchAll(/-?\d*\.?\d+/g)) {
    if (i % 2 === 0) max = Math.max(max, Number(m[0]));
    i += 1;
  }
  return max;
}

const svg = (vb, inner, label = 'Nemo') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r1).join(' ')}" role="img" aria-label="${label}">${inner}</svg>\n`;

/** The word alone (text colour of the theme). */
export function wordSvg(input = {}, theme = 'light', color) {
  const w = wordPath(input);
  const pad = 20;
  const fill = color ?? COLORS.text[theme];
  return {
    svg: svg([w.left - pad, -w.capHeight - pad, w.width + 2 * pad, w.capHeight + 2 * pad + 20], `<path fill="${fill}" d="${w.d}"/>`),
    width: w.width + 2 * pad,
    height: w.capHeight + 2 * pad + 20,
    word: w,
  };
}

export const LOCKUP_DEFAULTS = {
  source: 'mark', // mark | app  (transparent fish or the tile)
  markHeight: 1.2, // × cap height (or × x-height when align = 'x')
  gap: 0.42, // × cap height between mark and word
  align: 'cap', // cap | x: the mark is centred on that box
  dy: 0, // × cap height, nudge of the mark (+ = down)
};

/**
 * Mark + word side by side. `layers` from buildLayers (its `mark`/`app` SVG is embedded as geometry
 * via a nested <svg>), the word from wordPath. Returns { svg, width, height } in cap-height units
 * (height = the lockup's total height, so `height` px renders the whole lockup).
 */
export function lockupSvg(layers, word = {}, opts = {}, theme = 'light', colors = {}) {
  const o = merge(LOCKUP_DEFAULTS, opts);
  const w = wordPath(word);
  const C = w.capHeight;
  const box = o.align === 'x' ? w.xHeight : C;
  const src = o.source === 'app' ? layers.app : layers.mark;
  const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const inner = src.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const mh = box * o.markHeight;
  const mw = (mh * vb[2]) / vb[3];
  const my = -box / 2 - mh / 2 + o.dy * C; // centred on the align box
  const gap = o.gap * C;
  const textFill = colors.text ?? COLORS.text[theme];
  const pad = 12;
  const top = Math.min(my, -C) - pad;
  const bottom = Math.max(my + mh, 20) + pad;
  const wordX = mw + gap - w.left;
  const body =
    `<svg x="0" y="${r1(my)}" width="${r1(mw)}" height="${r1(mh)}" viewBox="${vb.join(' ')}">${inner}</svg>` +
    `<path fill="${textFill}" d="${shiftPath(w.d, wordX)}"/>`;
  const width = mw + gap + w.width + 2 * pad;
  return { svg: svg([-pad, top, width, bottom - top], body), width, height: bottom - top, markWidth: mw, markHeight: mh, word: w };
}
