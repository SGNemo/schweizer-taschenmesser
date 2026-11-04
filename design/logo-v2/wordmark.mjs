// Wordmark "Nemo" / "nemo": letters from the outlines in glyphs-inter.json (Inter, the app's
// typeface; tools/extract-glyphs.mjs) or, for comparison, the Nunito ExtraBold word of the previous
// logo (../icon/glyphs.json). Units: 1000 per em, baseline y = 0, cap height = `capHeight`.
//
//   wordPath(word)                        -> { d, width, left, capHeight, xHeight }
//   wordArt(word, art, theme)             -> the word with optional bands, head, tail, o-fish
//   wordSvg(word, art, theme)             -> standalone SVG of the word (art)
//   lockupSvg(layers, word, opts, theme)  -> mark + word side by side
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, merge } from './mark.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const GLYPHS = JSON.parse(readFileSync(join(here, 'glyphs-inter.json'), 'utf8'));
const NUNITO = JSON.parse(readFileSync(join(here, '../icon/glyphs.json'), 'utf8')).glyphs;
const NUNITO_CAP = 214; // glyph units of the Nunito word (baseline 0), x-height 150

export const WORD_DEFAULTS = {
  text: 'Nemo',
  family: 'inter', // inter | display | nunito (nunito: the previous wordmark's letters, "Nemo" only)
  weight: 600, // 500 | 600 | 700 | 800 (ignored for nunito)
  tracking: -0.01, // em, added between letters (ignored for nunito)
};

const r1 = (n) => Math.round(n * 10) / 10;
/** Apply fn(x, y) -> [x, y] to every coordinate pair of an absolute path (M/L/C/Q/Z, no H/V). */
function mapPath(d, fn) {
  let i = 0;
  let x = 0;
  return d.replace(/-?\d*\.?\d+/g, (m) => {
    const v = Number(m);
    if (i++ % 2 === 0) {
      x = v;
      return '\u0000';
    }
    const [nx, ny] = fn(x, v);
    return `${r1(nx)} ${r1(ny)}`;
  }).replace(/\u0000\s*/g, '');
}
const shiftPath = (d, dx) => mapPath(d, (x, y) => [x + dx, y]);
const scalePath = (d, k) => mapPath(d, (x, y) => [x * k, y * k]);
function edges(d) {
  let min = Infinity;
  let max = -Infinity;
  let i = 0;
  for (const m of d.matchAll(/-?\d*\.?\d+/g)) {
    if (i++ % 2 === 0) {
      min = Math.min(min, Number(m[0]));
      max = Math.max(max, Number(m[0]));
    }
  }
  return { min, max };
}

/** The word as one path, letters laid out with advances, kerning and tracking. */
/** Monoline rounded geometric letters ("Nemo"), drawn as strokes: { strokes, width, capHeight, xHeight }. */
const ROUND_WEIGHTS = { 500: 0.17, 600: 0.19, 700: 0.22, 800: 0.25, 900: 0.28 }; // stroke width × cap height
function roundLetters(C, text, weight, opt = {}) {
  const sw = C * (ROUND_WEIGHTS[weight] ?? 0.22);
  const xh = C * (opt.xHeight ?? 0.78);
  const r = (xh - sw) / 2; // centreline radius of the round letters
  const gap = sw * (opt.gap ?? 0.85); // space between letters
  const strokes = [];
  const butts = []; // strokes drawn with flat ends (the e's terminal when eCap = 'butt')
  let x = sw / 2;
  const cy = -xh / 2;
  const arch = (x0, ar, top) => `A${ar} ${ar} 0 0 1 ${x0 + 2 * ar} ${top}`;
  for (const ch of text) {
    if (ch === 'N') {
      const nw = C * (opt.nWidth ?? 0.74);
      strokes.push(`M${x} ${-sw / 2}L${x} ${-C + sw / 2}L${x + nw} ${-sw / 2}L${x + nw} ${-C + sw / 2}`);
      x += nw + gap + sw;
    } else if (ch === 'n') {
      const ar = r * (opt.archRatio ?? 0.8);
      const top = -xh + sw / 2 + ar;
      strokes.push(`M${x} ${-sw / 2}L${x} ${-xh + sw / 2}M${x} ${top}${arch(x, ar, top)}L${x + 2 * ar} ${-sw / 2}`);
      x += 2 * ar + gap + sw;
    } else if (ch === 'e') {
      const cx = x + r;
      const a = ((opt.eOpen ?? 38) * Math.PI) / 180;
      if (opt.eCap === 'butt') {
        // Bowl with a flat-cut terminal (its own stroke group), the bar on top with round ends.
        butts.push(`M${cx + r} ${cy}A${r} ${r} 0 0 0 ${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
        strokes.push(`M${cx - r} ${cy}L${cx + r} ${cy}`);
      } else {
        strokes.push(`M${cx - r} ${cy}L${cx + r} ${cy}A${r} ${r} 0 0 0 ${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
      }
      x = cx + r + gap + sw;
    } else if (ch === 'm') {
      const ar = r * (opt.archRatio ?? 0.62);
      const top = -xh + sw / 2 + ar;
      strokes.push(`M${x} ${-sw / 2}L${x} ${-xh + sw / 2}M${x} ${top}${arch(x, ar, top)}L${x + 2 * ar} ${-sw / 2}M${x + 2 * ar} ${top}${arch(x + 2 * ar, ar, top)}L${x + 4 * ar} ${-sw / 2}`);
      x += 4 * ar + gap + sw;
    } else if (ch === 'o') {
      const cx = x + r;
      strokes.push(`M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}`);
      x = cx + r + gap + sw;
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
    } else throw new Error(`round lettering: no letter "${ch}"`);
  }
  x -= gap; // no trailing gap
  return { strokes, butts, sw, width: x + sw / 2 - sw / 2, capHeight: C, xHeight: xh, left: 0 };
}

export function wordPath(input = {}) {
  const p = merge(WORD_DEFAULTS, input);
  if (p.family === 'round') {
    const C = GLYPHS.families.inter[600].capHeight;
    const rl = roundLetters(C, p.text, p.weight, p.round ?? {});
    // The strokes are kept as a stroke group (no outline), so `d` is empty and `strokes` carries the letters.
    return { d: '', strokes: rl.strokes, butts: rl.butts, strokeWidth: rl.sw, width: r1(rl.width), left: 0, capHeight: C, xHeight: rl.xHeight, font: 'Nemo rounded lettering (own)', params: p, letters: null };
  }
  if (p.family === 'nunito') {
    if (p.text !== 'Nemo') throw new Error('nunito: only "Nemo" is available');
    const k = GLYPHS.families.inter[600].capHeight / NUNITO_CAP; // same cap height as Inter 600
    const d = ['N', 'e', 'm', 'o'].map((l) => scalePath(NUNITO[l], k)).join('');
    const e = edges(d);
    return { d, width: r1(e.max - e.min), left: e.min, capHeight: r1(NUNITO_CAP * k), xHeight: r1(150 * k), font: 'Nunito ExtraBold (previous wordmark)', params: p, letters: null };
  }
  const fam = GLYPHS.families[p.family];
  if (!fam) throw new Error(`unknown family ${p.family}`);
  const face = fam[p.weight];
  if (!face) throw new Error(`weight ${p.weight} missing for ${p.family}`);
  const letters = [...p.text];
  let x = 0;
  const parts = [];
  const placed = [];
  letters.forEach((ch, i) => {
    const g = face.letters[ch];
    if (!g) throw new Error(`no outline for "${ch}"`);
    const e = edges(g.d);
    placed.push({ ch, x0: x + e.min, x1: x + e.max, d: shiftPath(g.d, x) });
    parts.push(placed.at(-1).d);
    const pair = ch + (letters[i + 1] ?? '');
    x += g.advance + (face.kern[pair] ?? 0) + (i < letters.length - 1 ? p.tracking * 1000 : 0);
  });
  const left = placed[0].x0;
  const right = placed.at(-1).x1;
  return { d: parts.join(''), width: r1(right - left), left, capHeight: face.capHeight, xHeight: face.xHeight, font: face.font, params: p, letters: placed };
}

const svg = (vb, inner, label = 'Nemo') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r1).join(' ')}" role="img" aria-label="${label}">${inner}</svg>\n`;

export const ART_DEFAULTS = {
  ink: 'text', // text | accent | contrast: colour of the letters (contrast = text on the filled accent)
  bands: null, // { at: [0.25, 0.6], perLetter: false, width: 0.1, slant: 0, bend: 0 }: white bands cut through the letters (at = fraction of the word width, or perLetter: one band through every letter's centre; width × cap height, slant in degrees)
  head: null, // { length: 0.9, gap: 0.12, eye: 0.14, eyeAt: [0.42, -0.2], overshoot: 0.06, band: 0 }: flat clownfish head in front of the first letter (× cap height); band > 0 cuts a band of that width through the head (at bandAt, 0 = nose .. 1 = back)
  tail: null, // { style: 'fan' | 'fork', length: 0.55, spread: 0.62, gap: 0.12, bulge: 0.12 }: caudal fin after the last letter
  ofish: null, // { layers, scale: 1.3, dy: 0 }: the mark replaces the last letter "o" (word 'Nem' + mark)
  badge: null, // { height: 1.9, tail: 0.5, spread: 0.6, eye: 0.14 }: the word knocked out of a fish silhouette (× cap height)
};

/**
 * The decorated word: { defs, body, box: {x, y, w, h} } in word units (baseline 0, letters start at
 * word.left). Everything accent-coloured shares one mask so the bands cut through letters, head and tail.
 */
export function wordArt(word = {}, art = {}, theme = 'light', uid = 'wa') {
  const a = merge(ART_DEFAULTS, art);
  const w = wordPath(a.ofish ? { ...word, text: (word.text ?? 'Nemo').replace(/o$/, '') } : word);
  const C = w.capHeight;
  const accent = COLORS.accent[theme];
  const fill = a.ink === 'accent' ? accent : a.ink === 'contrast' ? COLORS.accentContrast[theme] : COLORS.text[theme];
  const top = -C;
  const bot = 0;
  let box = { x: w.left, y: top, w: w.width, h: C };
  const shapes = []; // accent shapes drawn under the mask
  let defs = '';
  const holes = [];
  const softBands = []; // bands painted in the soft accent on top of the letters (clipped to them)

  // Head: a half egg, flat side towards the first letter, nose to the left; eye cut out.
  if (a.head) {
    const h = merge({ length: 0.9, gap: 0.12, eye: 0.14, eyeAt: [0.42, -0.22], overshoot: 0.06, round: 0.55, band: 0, bandAt: 0.68, bandBend: -0.06 }, a.head);
    const hx = w.left - h.gap * C; // flat back edge
    const nose = hx - h.length * C;
    const ov = h.overshoot * C;
    const mid = (top + bot) / 2;
    const half = C / 2 + ov;
    const k = h.round; // how round the nose is (0.55 ≈ circle quarter)
    const d = `M${hx} ${top - ov}C${hx - (hx - nose) * k} ${top - ov} ${nose} ${mid - half * k} ${nose} ${mid}C${nose} ${mid + half * k} ${hx - (hx - nose) * k} ${bot + ov} ${hx} ${bot + ov}Z`;
    shapes.push(mapPath(d, (x, y) => [x, y]));
    const ex = nose + (hx - nose) * h.eyeAt[0];
    const ey = mid + h.eyeAt[1] * C;
    holes.push(`<circle cx="${r1(ex)}" cy="${r1(ey)}" r="${r1(h.eye * C)}" fill="#000"/>`);
    if (h.band > 0) {
      const bx = nose + (hx - nose) * h.bandAt;
      holes.push(`<path d="M${r1(bx)} ${r1(top - ov - 20)}Q${r1(bx + 2 * h.bandBend * C)} ${r1(mid)} ${r1(bx)} ${r1(bot + ov + 20)}" fill="none" stroke="#000" stroke-width="${r1(h.band * C)}"/>`);
    }
    box = { x: nose, y: top - ov, w: w.left + w.width - nose, h: C + 2 * ov };
  }
  // Tail: fan or fork after the last letter.
  if (a.tail) {
    const t = merge({ style: 'fan', length: 0.55, spread: 0.62, gap: 0.12, bulge: 0.12, stalk: 0.34 }, a.tail);
    const x0 = w.left + w.width + t.gap * C;
    const cy = -w.xHeight / 2; // centred on the x-height (the "o")
    const st = t.stalk * C;
    const L = t.length * C;
    const s = t.spread * C;
    const xe = x0 + L;
    const b = t.bulge * C;
    const back = t.style === 'fork' ? `C${xe - b * 0.5} ${cy - s * 0.55} ${xe - b} ${cy - s * 0.2} ${xe - b} ${cy}C${xe - b} ${cy + s * 0.2} ${xe - b * 0.5} ${cy + s * 0.55} ${xe} ${cy + s}` : `C${xe + b} ${cy - s * 0.4} ${xe + b} ${cy + s * 0.4} ${xe} ${cy + s}`;
    const d = `M${x0} ${cy - st}C${x0 + L * 0.4} ${cy - st} ${xe - L * 0.3} ${cy - s} ${xe} ${cy - s}${back}C${xe - L * 0.3} ${cy + s} ${x0 + L * 0.4} ${cy + st} ${x0} ${cy + st}Z`;
    shapes.push(mapPath(d, (x, y) => [x, y]));
    const right = xe + (t.style === 'fan' ? b : 0);
    const yTop = Math.min(box.y, cy - s);
    const yBot = Math.max(box.y + box.h, cy + s);
    box = { x: box.x, y: yTop, w: right - box.x, h: yBot - yTop };
  }
  // Bands cut through everything accent-coloured.
  if (a.bands) {
    const b = merge({ at: [0.25, 0.6], perLetter: false, width: 0.1, slant: 0, bend: 0, letterAt: 0.5 }, a.bands);
    const tan = Math.tan((b.slant * Math.PI) / 180);
    const reach = C * 0.9;
    const mid = -C / 2;
    const xs = b.perLetter && w.letters ? w.letters.map((l) => l.x0 + (l.x1 - l.x0) * (typeof b.letterAt === 'number' ? b.letterAt : (b.letterAt[l.ch] ?? 0.5))) : b.at.map((at) => w.left + w.width * at);
    for (const x of xs) {
      const d = b.bend ? `M${x + reach * tan} ${mid - reach}Q${x + 2 * b.bend * C} ${mid} ${x - reach * tan} ${mid + reach}` : `M${x + reach * tan} ${mid - reach}L${x - reach * tan} ${mid + reach}`;
      const path = `<path d="${mapPath(d, (px, py) => [px, py])}" fill="none" stroke="${b.soft ? COLORS.accentSoft[theme] : '#000'}" stroke-width="${r1(b.width * C)}"/>`;
      if (b.soft) softBands.push(path);
      else holes.push(path);
    }
  }
  // Badge: an accent fish silhouette around the word; the word (and the eye) are knocked out.
  if (a.badge) {
    const b = merge({ height: 1.9, tail: 0.5, spread: 0.62, eye: 0.13, padLeft: 0.9, padRight: 0.35, blunt: 0.7 }, a.badge);
    const H = (b.height * C) / 2; // half height
    const cy = -C / 2;
    const xp = w.left - b.padLeft * C * 0.3; // tail joint sits left of the word
    const xn = w.left + w.width + b.padRight * C + C * 0.9; // nose right of the word
    const xm = xp + (xn - xp) * 0.5;
    const d1 = xm - xp;
    const d2 = xn - xm;
    const ph = H * 0.42;
    const k = b.blunt;
    const bodyD = `M${xp} ${cy - ph}C${xp + d1 * 0.32} ${cy - ph - (H - ph) * 0.5} ${xm - d1 * 0.42} ${cy - H} ${xm} ${cy - H}C${xm + d2 * k} ${cy - H} ${xn} ${cy - H * k} ${xn} ${cy}C${xn} ${cy + H * k} ${xm + d2 * k} ${cy + H} ${xm} ${cy + H}C${xm - d1 * 0.42} ${cy + H} ${xp + d1 * 0.32} ${cy + ph + (H - ph) * 0.5} ${xp} ${cy + ph}Z`;
    const L = b.tail * C;
    const s = b.spread * C;
    const xe = xp - L;
    const bl = 0.1 * C;
    const tailD = `M${xp + 0.2 * C} ${cy - ph}L${xp} ${cy - ph}C${xp - L * 0.4} ${cy - ph} ${xe + L * 0.3} ${cy - s} ${xe} ${cy - s}C${xe - bl} ${cy - s * 0.4} ${xe - bl} ${cy + s * 0.4} ${xe} ${cy + s}C${xe + L * 0.3} ${cy + s} ${xp - L * 0.4} ${cy + ph} ${xp} ${cy + ph}L${xp + 0.2 * C} ${cy + ph}Z`;
    shapes.push(mapPath(bodyD, (x, y) => [x, y]), mapPath(tailD, (x, y) => [x, y]));
    const ex = w.left + w.width + b.padRight * C + C * 0.45;
    holes.push(`<circle cx="${r1(ex)}" cy="${r1(cy - 0.2 * C)}" r="${r1(b.eye * C)}" fill="#000"/>`);
    holes.push(`<path d="${w.d}" fill="#000"/>`);
    box = { x: xe - bl, y: cy - Math.max(H, s), w: xn - xe + bl, h: 2 * Math.max(H, s) };
  }
  let body = '';
  const maskId = `${uid}-cut`;
  if (holes.length) {
    defs += `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${r1(box.x - 200)}" y="${r1(box.y - 200)}" width="${r1(box.w + 400)}" height="${r1(box.h + 400)}"><rect x="${r1(box.x - 200)}" y="${r1(box.y - 200)}" width="${r1(box.w + 400)}" height="${r1(box.h + 400)}" fill="#fff"/>${holes.join('')}</mask>`;
  }
  const masked = holes.length ? ` mask="url(#${maskId})"` : '';
  body += `<g${masked}>`;
  if (shapes.length) body += `<g fill="${accent}">${shapes.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  if (!a.badge)
    body += w.strokes
      ? (w.butts?.length ? `<g fill="none" stroke="${fill}" stroke-width="${r1(w.strokeWidth)}" stroke-linecap="butt" stroke-linejoin="round">${w.butts.map((d) => `<path d="${d}"/>`).join('')}</g>` : '') +
        `<g fill="none" stroke="${fill}" stroke-width="${r1(w.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">${w.strokes.map((d) => `<path d="${d}"/>`).join('')}</g>`
      : `<path fill="${fill}" d="${w.d}"/>`;
  body += `</g>`;
  if (softBands.length) {
    defs += `<clipPath id="${uid}-letters">${shapes.map((d) => `<path d="${d}"/>`).join('')}<path d="${w.d}"/></clipPath>`;
    body += `<g clip-path="url(#${uid}-letters)">${softBands.join('')}</g>`;
  }
  // o-fish: the mark where the "o" would be.
  if (a.ofish) {
    const o = merge({ scale: 1.25, dy: 0, gap: 0.08 }, a.ofish);
    const src = o.layers.mark;
    const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const inner = src.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const mh = w.xHeight * o.scale;
    const mw = (mh * vb[2]) / vb[3];
    const mx = w.left + w.width + o.gap * C;
    const my = -w.xHeight / 2 - mh / 2 + o.dy * C;
    body += `<svg x="${r1(mx)}" y="${r1(my)}" width="${r1(mw)}" height="${r1(mh)}" viewBox="${vb.join(' ')}">${inner}</svg>`;
    const yTop = Math.min(box.y, my);
    const yBot = Math.max(box.y + box.h, my + mh);
    box = { x: box.x, y: yTop, w: mx + mw - box.x, h: yBot - yTop };
  }
  return { defs, body, box, word: w, art: a };
}

/** The word (with its art) alone. */
export function wordSvg(word = {}, art = {}, theme = 'light') {
  const a = wordArt(word, art, theme, `w-${theme}`);
  const pad = 24;
  const vb = [a.box.x - pad, a.box.y - pad, a.box.w + 2 * pad, a.box.h + 2 * pad];
  return { svg: svg(vb, `<defs>${a.defs}</defs>${a.body}`), width: vb[2], height: vb[3], word: a.word, box: a.box };
}

export const LOCKUP_DEFAULTS = {
  source: 'mark', // mark | app | none (none: the word art alone, e.g. with head and tail)
  markHeight: 1.2, // × cap height (or × x-height when align = 'x')
  gap: 0.42, // × cap height between mark and word
  align: 'cap', // cap | x: the mark is centred on that box
  dy: 0, // × cap height, nudge of the mark (+ = down)
  art: null, // word art (see ART_DEFAULTS)
  pill: null, // { padX: 0.4, padY: 0.3, radius: 0.5 }: accent pill behind mark and word (both in the contrast colour), × cap height
};

/**
 * Mark + word side by side. `layers` from buildLayers; returns { svg, width, height } where height
 * is the lockup's total height (so rendering at `height` px shows everything).
 */
export function lockupSvg(layers, word = {}, opts = {}, theme = 'light') {
  const o = merge(LOCKUP_DEFAULTS, opts);
  const art = o.pill ? { ...(o.art ?? {}), ink: 'contrast' } : o.art ?? {};
  const a = wordArt(word, art, theme, `l-${theme}`);
  const w = a.word;
  const C = w.capHeight;
  const pad = 12;
  let mw = 0;
  let gap = 0;
  let markSvg = '';
  let top = a.box.y;
  let bottom = a.box.y + a.box.h;
  if (o.source !== 'none') {
    const src = o.pill ? layers.markIn(COLORS.accentContrast[theme]) : o.source === 'app' ? layers.app : layers.mark;
    const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const inner = src.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const box = o.align === 'x' ? w.xHeight : C;
    const mh = box * o.markHeight;
    mw = (mh * vb[2]) / vb[3];
    const my = -box / 2 - mh / 2 + o.dy * C;
    gap = o.gap * C;
    markSvg = `<svg x="0" y="${r1(my)}" width="${r1(mw)}" height="${r1(mh)}" viewBox="${vb.join(' ')}">${inner}</svg>`;
    top = Math.min(top, my);
    bottom = Math.max(bottom, my + mh);
  }
  const dx = mw + gap - a.box.x; // word art starts right after the mark
  let body = `${markSvg}<g transform="translate(${r1(dx)} 0)"><defs>${a.defs}</defs>${a.body}</g>`;
  let width = mw + gap + a.box.w + 2 * pad;
  let height = bottom - top + 2 * pad;
  let x0 = -pad;
  let y0 = top - pad;
  if (o.pill) {
    const p = merge({ padX: 0.4, padY: 0.3, radius: 0.5 }, o.pill);
    const px = p.padX * C;
    const py = p.padY * C;
    const rx = p.radius * (bottom - top + 2 * py);
    body = `<rect x="${r1(-px)}" y="${r1(top - py)}" width="${r1(mw + gap + a.box.w + 2 * px)}" height="${r1(bottom - top + 2 * py)}" rx="${r1(rx)}" fill="${COLORS.accent[theme]}"/>` + body;
    x0 = -px - 4;
    y0 = top - py - 4;
    width = mw + gap + a.box.w + 2 * px + 8;
    height = bottom - top + 2 * py + 8;
  }
  return { svg: svg([x0, y0, width, height], body), width, height, markWidth: mw, word: w };
}
