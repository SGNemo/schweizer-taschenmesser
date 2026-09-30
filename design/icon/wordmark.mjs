// Wordmark concepts where the word "Nemo" itself becomes the fish.
// Letters: Nunito ExtraBold outlines (OFL) taken from web/brand/logo-wordmark.svg,
// in glyph units (baseline y = 0, cap height 214, x-height 150, word spans x 21..824).
//
// buildWordmark(concept, params, theme) -> standalone SVG string (theme: light | dark)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merge } from './fish.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../web/brand/logo-wordmark.svg'), 'utf8');
const glyphD = src.match(/translate\(343\.7 225\.8\)"[^>]*\sd="([^"]+)"/)[1];
const sub = glyphD.split(/(?=M)/);
export const GLYPHS = { N: sub[0], e: sub[1] + sub[2], m: sub[3], o: sub[4] + sub[5] };
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

const CONCEPTS = { body, headfin, ofish, swoosh };

export function buildWordmark(concept, params = {}, theme = 'light') {
  const p = merge(WM_DEFAULTS, params);
  return CONCEPTS[concept](p, theme);
}
