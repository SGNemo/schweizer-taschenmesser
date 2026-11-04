// The name "NEMO" as an own drawing (no font, no third-party outlines): monoline capitals built from
// stems, bars, diagonals and a circle, stroked with round ends – the same soft corners as the fish –
// and the lockup of mark + name on an accent pill.
//
//   wordPath(word)                         -> { strokes, strokeWidth, width, capHeight }
//   wordArt(word, art, theme)              -> the letters as SVG, { body, box, word }
//   lockupSvg(layers, word, opts, theme)   -> mark + name (optionally on the pill): { svg, body, pill, ... }
//
// Units: 1000 per em (cap height 727.5, the proportion the first sheets used), baseline y = 0, up is negative.
import { COLORS, merge } from './mark.mjs';

const CAP_HEIGHT = 727.5;
const r1 = (n) => Math.round(n * 10) / 10;

export const WORD_DEFAULTS = {
  text: 'NEMO',
  weight: 700, // stroke width as a fraction of the cap height: 500 .17 · 600 .19 · 700 .22 · 800 .25 · 900 .28
  round: {}, // letter settings: gap (× stroke), nWidth, eWidth, eMid, eMidLen, mWidth, mVertex (0 = baseline .. 1 = cap height), oWide
};
const ROUND_WEIGHTS = { 500: 0.17, 600: 0.19, 700: 0.22, 800: 0.25, 900: 0.28 };

/** Monoline capitals N E M O as stroked paths (the lettering the final logo uses). */
function roundLetters(C, text, weight, opt = {}) {
  const sw = C * (ROUND_WEIGHTS[weight] ?? 0.22);
  const gap = sw * (opt.gap ?? 0.85); // space between letters
  const strokes = [];
  let x = sw / 2;
  for (const ch of text) {
    if (ch === 'N') {
      const nw = C * (opt.nWidth ?? 0.74);
      strokes.push(`M${x} ${-sw / 2}L${x} ${-C + sw / 2}L${x + nw} ${-sw / 2}L${x + nw} ${-C + sw / 2}`);
      x += nw + gap + sw;
    } else if (ch === 'E') {
      // stem + three bars; the middle bar a little shorter
      const ew = C * (opt.eWidth ?? 0.56);
      const mid = -C / 2 + C * (opt.eMid ?? 0);
      strokes.push(`M${x + ew} ${-C + sw / 2}L${x} ${-C + sw / 2}L${x} ${-sw / 2}L${x + ew} ${-sw / 2}M${x} ${mid}L${x + ew * (opt.eMidLen ?? 0.86)} ${mid}`);
      x += ew + gap + sw;
    } else if (ch === 'M') {
      // two stems, the diagonals meet at mVertex (0 = baseline, 0.5 = half way up)
      const mw = C * (opt.mWidth ?? 0.98);
      const vy = -sw / 2 - (C - sw) * (opt.mVertex ?? 0);
      strokes.push(`M${x} ${-sw / 2}L${x} ${-C + sw / 2}L${x + mw / 2} ${vy}L${x + mw} ${-C + sw / 2}L${x + mw} ${-sw / 2}`);
      x += mw + gap + sw;
    } else if (ch === 'O') {
      const R = (C - sw) / 2;
      const rx = R * (opt.oWide ?? 1);
      const cx = x + rx;
      const cyc = -C / 2;
      strokes.push(`M${cx + rx} ${cyc}A${rx} ${R} 0 1 0 ${cx - rx} ${cyc}A${rx} ${R} 0 1 0 ${cx + rx} ${cyc}`);
      x = cx + rx + gap + sw;
    } else throw new Error(`lettering: no letter "${ch}" (N, E, M, O only)`);
  }
  x -= gap; // no trailing gap
  return { strokes, sw, width: x };
}

/** The word as stroked paths; `left` is 0 (the first stem's outer edge). */
export function wordPath(input = {}) {
  const p = merge(WORD_DEFAULTS, input);
  const rl = roundLetters(CAP_HEIGHT, p.text, p.weight, p.round);
  return { strokes: rl.strokes, strokeWidth: rl.sw, width: r1(rl.width), left: 0, capHeight: CAP_HEIGHT, params: p };
}

const svg = (vb, inner, label = 'Nemo') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r1).join(' ')}" role="img" aria-label="${label}">${inner}</svg>\n`;

/**
 * The letters as an SVG fragment: { body, box: {x, y, w, h}, word }. `art.ink`: 'text' (default),
 * 'accent' or 'contrast' (the text colour on the filled accent; `art.inkColor` overrides it, e.g. with a CSS variable).
 */
export function wordArt(word = {}, art = {}, theme = 'light') {
  const w = wordPath(word);
  const fill = art.ink === 'accent' ? COLORS.accent[theme] : art.ink === 'contrast' ? (art.inkColor ?? COLORS.accentContrast[theme]) : COLORS.text[theme];
  const body = `<g fill="none" stroke="${fill}" stroke-width="${r1(w.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">${w.strokes.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  return { body, box: { x: w.left, y: -w.capHeight, w: w.width, h: w.capHeight }, word: w };
}

export const LOCKUP_DEFAULTS = {
  source: 'mark', // mark | none (none: the name alone)
  markHeight: 1.2, // × cap height
  gap: 0.42, // × cap height between mark and name
  dy: 0, // × cap height, nudge of the mark (+ = down)
  pill: null, // { padX: 0.4, padY: 0.3, radius: 0.5 }: accent pill behind mark and name (both in the contrast colour), × cap height
  colors: null, // { pill, ink }: overrides the pill's fill and the mark/name colour (literals or CSS variables)
  margin: 4, // transparent margin around the pill in the returned SVG (the brand export builds its own view box)
};

/**
 * Mark + name side by side. `layers` from buildLayers. Returns { svg, body, pill, width, height, markWidth, word }:
 * `body` is the markup without the root element, `pill` the pill's rectangle in the same units (or null),
 * `height` the total height (so rendering at `height` px shows everything).
 */
export function lockupSvg(layers, word = {}, opts = {}, theme = 'light') {
  const o = merge(LOCKUP_DEFAULTS, opts);
  const inkColor = o.colors?.ink ?? COLORS.accentContrast[theme];
  const pillColor = o.colors?.pill ?? COLORS.accent[theme];
  const a = wordArt(word, o.pill ? { ink: 'contrast', inkColor } : { ink: 'text' }, theme);
  const w = a.word;
  const C = w.capHeight;
  const pad = 12;
  let mw = 0;
  let gap = 0;
  let markSvg = '';
  let top = a.box.y;
  let bottom = a.box.y + a.box.h;
  if (o.source !== 'none') {
    const src = o.pill ? layers.markIn(inkColor) : layers.mark;
    const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const inner = src.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const mh = C * o.markHeight;
    mw = (mh * vb[2]) / vb[3];
    const my = -C / 2 - mh / 2 + o.dy * C;
    gap = o.gap * C;
    markSvg = `<svg x="0" y="${r1(my)}" width="${r1(mw)}" height="${r1(mh)}" viewBox="${vb.join(' ')}">${inner}</svg>`;
    top = Math.min(top, my);
    bottom = Math.max(bottom, my + mh);
  }
  const dx = mw + gap - a.box.x; // the name starts right after the mark
  let body = `${markSvg}<g transform="translate(${r1(dx)} 0)">${a.body}</g>`;
  let width = mw + gap + a.box.w + 2 * pad;
  let height = bottom - top + 2 * pad;
  let x0 = -pad;
  let y0 = top - pad;
  let pill = null;
  if (o.pill) {
    const p = merge({ padX: 0.4, padY: 0.3, radius: 0.5 }, o.pill);
    const px = p.padX * C;
    const py = p.padY * C;
    const rx = p.radius * (bottom - top + 2 * py);
    pill = { x: -px, y: top - py, w: mw + gap + a.box.w + 2 * px, h: bottom - top + 2 * py, rx };
    body = `<rect x="${r1(pill.x)}" y="${r1(pill.y)}" width="${r1(pill.w)}" height="${r1(pill.h)}" rx="${r1(rx)}" fill="${pillColor}"/>` + body;
    x0 = pill.x - o.margin;
    y0 = pill.y - o.margin;
    width = pill.w + 2 * o.margin;
    height = pill.h + 2 * o.margin;
  }
  return { svg: svg([x0, y0, width, height], body), body, pill, width, height, markWidth: mw, word: w };
}
