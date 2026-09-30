// Wordmark concepts where the word "Nemo" itself becomes the fish.
// Letters: Nunito ExtraBold outlines (OFL) from glyphs.json (taken from the previous logo-wordmark.svg),
// in glyph units (baseline y = 0, cap height 214, x-height 150, word spans x 21..824).
//
// buildWordmark(concept, params, theme) -> standalone SVG string (theme: light | dark)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merge } from './fish.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const GLYPHS = JSON.parse(readFileSync(join(here, 'glyphs.json'), 'utf8')).glyphs;
const O = { cx: 745.5, cy: -73.5, r: 78 };

export const WM_DEFAULTS = {
  colors: {
    fish: '#F26A1E',
    stripe: '#FFFFFF',
    edge: '#14202B',
    text: { light: '#13262F', dark: '#E7F1F2' },
    eye: '#14202B',
  },
  eye: 22,
  edge: 7,
  pad: 24,
};

const r2 = (n) => Math.round(n * 100) / 100;
const f = (s) => s.replace(/-?\d+\.\d+/g, (m) => String(r2(Number(m))));
const word = (letters, fill) => `<path fill="${fill}" d="${letters.map((l) => GLYPHS[l]).join('')}"/>`;
const wrap = (vb, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(r2).join(' ')}" role="img" aria-label="Nemo">${inner}</svg>\n`;

// A · Fischkörper: the word is cut out of a long fish body (head + eye at N, fan tail after o).
function body(p, theme) {
  const c = p.colors;
  const cy = -106;
  const h = p.height ?? 150;
  const x0 = -130;
  const xj = 900; // tail joint
  const st = 70;
  const tl = p.tail ?? 120;
  // Top: high over the N, sinking gently towards the tail joint; bottom nearly flat.
  const body =
    `M${x0} ${cy}C${x0} ${cy - h * 0.7} ${x0 + 80} ${cy - h} ${x0 + 200} ${cy - h}` +
    `C${x0 + 520} ${cy - h} 760 ${cy - h * 0.62} ${xj + 20} ${cy - st}L${xj + 20} ${cy + st}` +
    `C${xj - 10} ${cy + h * 0.95} ${x0 + 520} ${cy + h} ${x0 + 200} ${cy + h}C${x0 + 80} ${cy + h} ${x0} ${cy + h * 0.7} ${x0} ${cy}Z`;
  const tail =
    `M${xj} ${cy - st}C${xj + tl * 0.4} ${cy - st} ${xj + tl * 0.8} ${cy - h * 0.95} ${xj + tl} ${cy - h * 0.95}` +
    `C${xj + tl + 28} ${cy - h * 0.4} ${xj + tl + 28} ${cy + h * 0.4} ${xj + tl} ${cy + h * 0.95}` +
    `C${xj + tl * 0.8} ${cy + h * 0.95} ${xj + tl * 0.4} ${cy + st} ${xj} ${cy + st}Z`;
  const eye = { x: x0 + 72, y: cy - 40 };
  const band = `M${xj - 6} ${cy - h - 20}Q${xj - 26} ${cy} ${xj - 6} ${cy + h + 20}`;
  const inner =
    `<defs><mask id="wm-a" maskUnits="userSpaceOnUse" x="-400" y="-500" width="1800" height="900"><rect x="-400" y="-500" width="1800" height="900" fill="#fff"/>` +
    `${word(['N', 'e', 'm', 'o'], '#000')}<path d="${f(band)}" fill="none" stroke="#000" stroke-width="${p.band ?? 26}"/>` +
    `<circle cx="${eye.x}" cy="${eye.y}" r="${p.eye}" fill="#000"/></mask></defs>` +
    `<g fill="${c.fish}" mask="url(#wm-a)"><path d="${f(body)}"/><path d="${f(tail)}"/></g>`;
  const pad = p.pad;
  return wrap([x0 - pad, cy - h - pad, xj + tl + 28 - x0 + 2 * pad, 2 * h + 2 * pad], inner);
}

// B · Kopf & Flosse: orange letters are the body; a head with eye sits before the N,
// a fan tail after the o; the gaps with dark edges read as the white bands.
function headfin(p, theme) {
  const c = p.colors;
  const top = -214;
  const bot = 3;
  const hx = -18; // head's flat back edge
  const nose = hx - (p.head ?? 150);
  const mid = (top + bot) / 2;
  const head = `M${hx} ${top}Q${hx - 26} ${mid} ${hx} ${bot}C${hx - 70} ${bot} ${nose} ${mid + 70} ${nose} ${mid}C${nose} ${mid - 70} ${hx - 70} ${top} ${hx} ${top}Z`;
  const fx = 852;
  const fl = p.tail ?? 120;
  const tail = `M${fx} ${-112}L${fx} ${-35}C${fx + fl * 0.5} ${-35} ${fx + fl * 0.8} ${25} ${fx + fl} ${25}C${fx + fl + 22} ${-40} ${fx + fl + 22} ${-107} ${fx + fl} ${-172}C${fx + fl * 0.8} ${-172} ${fx + fl * 0.5} ${-112} ${fx} ${-112}Z`;
  const e = p.edge;
  let inner = word(['N', 'e', 'm', 'o'], c.fish);
  inner += `<path fill="${c.fish}" d="${f(head)}"/><path fill="${c.fish}" d="${f(tail)}"/>`;
  inner += `<circle cx="${nose + 58}" cy="${mid - 30}" r="${p.eye}" fill="${c.eye}"/>`;
  const pad = p.pad;
  return wrap([nose - pad, top - pad, fx + fl + 22 - nose + 2 * pad, bot - top + 2 * pad + 22], inner);
}

// C · o-Fisch: "Nem" in text colour, the o is a round clownfish swimming into the word,
// its tail fin ends the word.
function ofish(p, theme) {
  const c = p.colors;
  const { cx, cy, r } = O;
  const R = r * (p.scale ?? 1.04);
  const tl = p.tail ?? 84;
  const xj = cx + R * 0.82;
  const tail = `M${xj - 10} ${cy - 26}C${xj + tl * 0.4} ${cy - 26} ${xj + tl * 0.7} ${cy - R * 0.8} ${xj + tl} ${cy - R * 0.8}C${xj + tl + 18} ${cy - R * 0.3} ${xj + tl + 18} ${cy + R * 0.3} ${xj + tl} ${cy + R * 0.8}C${xj + tl * 0.7} ${cy + R * 0.8} ${xj + tl * 0.4} ${cy + 26} ${xj - 10} ${cy + 26}Z`;
  const bx = cx + R * 0.18;
  const band = `M${bx} ${cy - R - 10}Q${bx - 22} ${cy} ${bx} ${cy + R + 10}`;
  const e = p.edge;
  const bw = p.band ?? 30;
  let inner = word(['N', 'e', 'm'], c.text[theme]);
  inner += `<defs><clipPath id="wm-c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs>`;
  inner += `<path fill="${c.fish}" d="${f(tail)}"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.fish}"/>`;
  inner += `<g clip-path="url(#wm-c)" fill="none">${e > 0 ? `<path d="${f(band)}" stroke="${c.edge}" stroke-width="${bw + 2 * e}"/>` : ''}<path d="${f(band)}" stroke="${c.stripe}" stroke-width="${bw}"/></g>`;
  inner += `<circle cx="${r2(cx - R * 0.5)}" cy="${r2(cy - R * 0.22)}" r="${p.eye}" fill="${c.eye}"/>`;
  const pad = p.pad;
  return wrap([-pad, -214 - pad, xj + tl + 18 + 2 * pad, 214 + 2 * pad + 6], inner);
}

// D · Unterstrich-Fisch: clean word; a slim fish starts under the N (head + eye)
// and ends with its tail fin after the o.
function swoosh(p, theme) {
  const c = p.colors;
  const y = p.y ?? 72; // centre line below the baseline
  const h = p.height ?? 40;
  const x0 = 10;
  const xj = 800;
  const tl = p.tail ?? 90;
  const body = `M${x0} ${y}C${x0} ${y - h * 0.7} ${x0 + 40} ${y - h} ${x0 + 110} ${y - h}C${x0 + 400} ${y - h} ${xj - 120} ${y - 10} ${xj} ${y - 10}L${xj} ${y + 10}C${xj - 120} ${y + 10} ${x0 + 400} ${y + h} ${x0 + 110} ${y + h}C${x0 + 40} ${y + h} ${x0} ${y + h * 0.7} ${x0} ${y}Z`;
  const tail = `M${xj - 8} ${y - 10}C${xj + tl * 0.5} ${y - 10} ${xj + tl * 0.8} ${y - h * 1.5} ${xj + tl} ${y - h * 1.5}C${xj + tl + 14} ${y - h * 0.6} ${xj + tl + 14} ${y + h * 0.6} ${xj + tl} ${y + h * 1.5}C${xj + tl * 0.8} ${y + h * 1.5} ${xj + tl * 0.5} ${y + 10} ${xj - 8} ${y + 10}Z`;
  const bands = (p.bands ?? [175, 380]).map((x) => `M${x} ${y - 60}L${x} ${y + 60}`);
  const e = p.edge;
  const bw = p.band ?? 22;
  let inner = `<defs><clipPath id="wm-d"><path d="${f(body)}"/></clipPath></defs>`;
  inner += word(['N', 'e', 'm', 'o'], c.text[theme]);
  inner += `<path fill="${c.fish}" d="${f(body)}"/><path fill="${c.fish}" d="${f(tail)}"/>`;
  inner += `<g clip-path="url(#wm-d)" fill="none">${bands.map((d) => (e > 0 ? `<path d="${d}" stroke="${c.edge}" stroke-width="${bw + 2 * e}"/>` : '') + `<path d="${d}" stroke="${c.stripe}" stroke-width="${bw}"/>`).join('')}</g>`;
  inner += `<circle cx="${x0 + 60}" cy="${y - 8}" r="${p.eye}" fill="${c.eye}"/>`;
  const pad = p.pad;
  return wrap([-pad, -214 - pad, xj + tl + 14 + 2 * pad, 214 + y + h * 1.5 + 2 * pad], inner);
}

// Head (facing left, flat/curved back edge at hx) and fan tail (joint at fx), centred on cy.
function headAt(hx, cy, hh, len) {
  const nose = hx - len;
  return {
    nose,
    d: `M${hx} ${cy - hh}Q${hx - 26} ${cy} ${hx} ${cy + hh}C${hx - 70} ${cy + hh} ${nose} ${cy + 70} ${nose} ${cy}C${nose} ${cy - 70} ${hx - 70} ${cy - hh} ${hx} ${cy - hh}Z`,
  };
}
function tailAt(fx, cy, hh, fl, st) {
  return `M${fx} ${cy - st}L${fx} ${cy + st}C${fx + fl * 0.5} ${cy + st} ${fx + fl * 0.8} ${cy + hh} ${fx + fl} ${cy + hh}C${fx + fl + 22} ${cy + hh * 0.35} ${fx + fl + 22} ${cy - hh * 0.35} ${fx + fl} ${cy - hh}C${fx + fl * 0.8} ${cy - hh} ${fx + fl * 0.5} ${cy - st} ${fx} ${cy - st}Z`;
}

// E · Gräten: W2's head and tail on a spine along the baseline; the thin letters stand on it
// like the upper bones, short ribs hang below (and optionally between the letters).
const BONE_LETTERS = [
  'M30 0V-214L190 0V-214',
  'M232 -75H370A70 70 0 1 0 353.6 -30',
  'M410 0V-150M410 -95C410 -135 432 -150 467 -150C502 -150 525 -135 525 -95V0M525 -95C525 -135 547 -150 582 -150C617 -150 640 -135 640 -95V0',
  'M745 -147A72 72 0 1 1 744.99 -147',
];
const RIBS_BELOW = [30, 110, 190, 300, 410, 467, 525, 582, 640, 745];
const RIBS_ABOVE = [206, 386, 652];
function bones(p, theme) {
  const c = p.colors;
  const sw = p.stroke ?? 24;
  const cy = 0; // spine = baseline
  const ink = p.bone ? p.bone[theme] : c.fish;
  const hx = -30;
  const head = headAt(hx, cy - 20, 128, p.head ?? 160);
  const fx = 858;
  const fl = p.tail ?? 120;
  const rib = (x, dir, len) => `M${x} ${cy}Q${x + 6} ${cy + dir * len * 0.6} ${x + 26} ${cy + dir * len}`;
  let inner = `<g fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">`;
  inner += `<path d="M${hx} ${cy}H${fx}"/>`;
  inner += BONE_LETTERS.map((d) => `<path d="${d}"/>`).join('');
  inner += `</g><g fill="none" stroke="${ink}" stroke-width="${sw * 0.7}" stroke-linecap="round">`;
  inner += RIBS_BELOW.map((x) => `<path d="${rib(x, 1, p.ribLen ?? 70)}"/>`).join('');
  if (p.ribsAbove) inner += RIBS_ABOVE.map((x) => `<path d="M${x} ${cy}Q${x + 2} ${cy - 40} ${x + 10} ${cy - 62}"/>`).join('');
  inner += `</g>`;
  inner += `<path fill="${c.fish}" d="${f(head.d)}"/><path fill="${c.fish}" d="${f(tailAt(fx - 6, cy - 20, 110, fl, 34))}"/>`;
  inner += `<circle cx="${head.nose + 60}" cy="${cy - 60}" r="${p.eye}" fill="${c.eye}"/>`;
  const pad = p.pad;
  return wrap([head.nose - pad, -214 - sw / 2 - pad, fx + fl + 22 - head.nose + 2 * pad, 214 + sw + 2 * pad + 100], inner);
}

// F · Schreibschrift: one pen line writes "Nem" and flows into the fish, which ends with its tail.
// Broad-nib look: the same centre line stamped along the nib direction.
const SCRIPT = {
  // Lead-in swash + N (ends with a small hook, pen lifts), e, m flowing into the fish.
  word:
    'M18 196C60 198 92 150 112 60C116 42 120 28 124 22C136 70 168 160 188 196C196 150 204 70 214 24C220 18 232 20 240 30' +
    'M238 170C270 170 300 150 298 125C296 100 258 100 252 135C246 172 268 200 305 196' +
    'C315 190 318 140 322 112L322 196C322 150 330 108 350 108C370 108 375 130 375 196C375 150 383 108 403 108C423 108 428 130 428 170C428 192 432 198 440 196',
  fish: 'M440 196C450 196 460 160 490 145C520 132 560 128 590 128C592 108 602 96 610 96C620 96 626 112 630 128C672 130 710 140 745 158C775 145 800 115 820 95C810 130 810 190 825 230C800 215 772 195 745 178C700 205 620 215 560 212C510 210 475 200 462 185C456 178 458 166 472 160',
  body: 'M465 170C470 155 480 150 490 145C520 132 560 128 590 128L630 128C672 130 710 140 745 158L745 178C700 205 620 215 560 212C510 210 475 200 462 185C458 180 460 175 465 170Z',
  band: 'M540 110Q525 170 542 230',
  eye: [494, 163],
};
function script(p, theme) {
  const c = p.colors;
  const ink = p.ink ? p.ink[theme] : c.text[theme];
  const nib = p.nib ?? 12;
  const a = ((p.nibAngle ?? 40) * Math.PI) / 180;
  const steps = 9;
  const stamp = (d, w) => {
    let o = '';
    for (let i = 0; i < steps; i++) {
      const t = -nib / 2 + (nib * i) / (steps - 1);
      o += `<path d="${d}" transform="translate(${r2(Math.cos(a) * t)} ${r2(-Math.sin(a) * t)})"/>`;
    }
    return `<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${o}</g>`;
  };
  let inner = '';
  if (p.fill) {
    inner += `<defs><clipPath id="wm-f"><path d="${SCRIPT.body}"/></clipPath></defs>`;
    inner += `<path fill="${c.fish}" d="${SCRIPT.body}"/>`;
    inner += `<path clip-path="url(#wm-f)" d="${SCRIPT.band}" fill="none" stroke="${c.stripe}" stroke-width="${p.band ?? 30}"/>`;
  }
  inner += stamp(SCRIPT.word, p.hair ?? 3.2) + stamp(SCRIPT.fish, p.hair ?? 3.2);
  inner += `<circle cx="${SCRIPT.eye[0]}" cy="${SCRIPT.eye[1]}" r="${p.eye * 0.45}" fill="${ink}"/>`;
  return wrap([0, 0, 850, 250], inner);
}

const CONCEPTS = { body, headfin, ofish, swoosh, bones, script };

export function buildWordmark(concept, params = {}, theme = 'light') {
  const p = merge(WM_DEFAULTS, params);
  return CONCEPTS[concept](p, theme);
}
