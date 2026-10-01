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
  // fan tail (default) or a forked tail with a notch, closer to the app icon's fish
  const tail =
    p.tailStyle === 'fork'
      ? `M${fx} ${-112}L${fx} ${-35}C${fx + fl * 0.45} ${-30} ${fx + fl * 0.75} ${20} ${fx + fl} ${28}C${fx + fl + 14} ${-20} ${fx + fl * 0.72} ${-55} ${fx + fl * 0.62} ${mid}C${fx + fl * 0.72} ${-150} ${fx + fl + 14} ${-185} ${fx + fl} ${-238}C${fx + fl * 0.75} ${-230} ${fx + fl * 0.45} ${-180} ${fx} ${-112}Z`
      : `M${fx} ${-112}L${fx} ${-35}C${fx + fl * 0.5} ${-35} ${fx + fl * 0.8} ${25} ${fx + fl} ${25}C${fx + fl + 22} ${-40} ${fx + fl + 22} ${-107} ${fx + fl} ${-172}C${fx + fl * 0.8} ${-172} ${fx + fl * 0.5} ${-112} ${fx} ${-112}Z`;
  const stripeW = p.stripe ?? 0; // head stripe cut out (background shows through), like the mark
  const sx = nose + (p.stripeAt ?? 100);
  const stripe = `M${sx + 8} ${top - 20}Q${sx - 26} ${mid} ${sx + 8} ${bot + 20}`;
  const id = `wm-hs-${theme}`;
  let inner = word(['N', 'e', 'm', 'o'], c.fish);
  if (stripeW > 0) {
    inner += `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${nose - 50}" y="${top - 50}" width="400" height="${bot - top + 100}"><rect x="${nose - 50}" y="${top - 50}" width="400" height="${bot - top + 100}" fill="#fff"/><path d="${f(stripe)}" fill="none" stroke="#000" stroke-width="${stripeW}"/></mask></defs>`;
    inner += `<path fill="${c.fish}" d="${f(head)}" mask="url(#${id})"/>`;
  } else {
    inner += `<path fill="${c.fish}" d="${f(head)}"/>`;
  }
  if (p.band) {
    // white band with a dark edge, clipped to the head (same look as the o-fish in W3)
    const cid = `wm-hc-${theme}`;
    inner += `<defs><clipPath id="${cid}"><path d="${f(head)}"/></clipPath></defs>`;
    inner += `<g clip-path="url(#${cid})" fill="none">${p.edge > 0 ? `<path d="${f(stripe)}" stroke="${c.edge}" stroke-width="${p.band + 2 * p.edge}"/>` : ''}<path d="${f(stripe)}" stroke="${c.stripe}" stroke-width="${p.band}"/></g>`;
  }
  inner += `<path fill="${c.fish}" d="${f(tail)}"/>`;
  if (flat) {
    inner += `<circle cx="${nose + 56}" cy="${mid - 26}" r="${p.eye}" fill="${c.eye}"/><circle cx="${nose + 56 - p.eye * 0.35}" cy="${mid - 26 - p.eye * 0.35}" r="${p.eye * 0.3}" fill="${c.stripe}"/>`;
  } else {
    inner += `<circle cx="${nose + 58}" cy="${mid - 30}" r="${p.eye}" fill="${c.eye}"/>`;
  }
  const pad = p.pad;
  const h = p.tailStyle === 'fork' ? 262 : bot - top + 22;
  return wrap([nose - pad, (p.tailStyle === 'fork' ? -238 : top) - pad, fx + fl + 22 - nose + 2 * pad, h + 2 * pad], inner);
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


// F · Clownfisch: the letters are the body; real clownfish fins (rounded, dark edge with a pale
// rim) sit around the word, the white bands show on head and tail base, the tail fin is round.
function clown(p, theme) {
  const c = p.colors;
  const top = -214;
  const bot = 3;
  const mid = (top + bot) / 2;
  const hx = -18;
  const nose = hx - (p.head ?? 190);
  const flat = p.headStyle === 'flat';
  // flat: straight vertical back edge, pointed nose (reference picture); default: slightly concave back
  const head = flat
    ? `M${hx} ${top + 4}L${hx} ${bot - 4}C${hx - 80} ${bot + 2} ${nose + 60} ${mid + 62} ${nose} ${mid}C${nose + 60} ${mid - 62} ${hx - 80} ${top - 2} ${hx} ${top + 4}Z`
    : `M${hx} ${top}Q${hx - 26} ${mid} ${hx} ${bot}C${hx - 70} ${bot} ${nose} ${mid + 70} ${nose} ${mid}C${nose} ${mid - 70} ${hx - 70} ${top} ${hx} ${top}Z`;
  const e = p.edge;
  const rim = p.rim ?? 8; // pale inner rim of every fin
  // fin: orange fill, dark outer edge, pale rim just inside (stroke order: edge, rim, fill)
  const fin = (d) =>
    `<path d="${f(d)}" fill="none" stroke="${c.stripe}" stroke-width="${2 * (e + rim)}" stroke-linejoin="round"/>` +
    `<path d="${f(d)}" fill="none" stroke="${c.edge}" stroke-width="${2 * e}" stroke-linejoin="round"/>` +
    `<path d="${f(d)}" fill="${c.fish}"/>`;
  // white band with dark edge, clipped to a shape
  const band = (clipId, shape, d, w) =>
    `<defs><clipPath id="${clipId}"><path d="${f(shape)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})" fill="none"><path d="${f(d)}" stroke="${c.edge}" stroke-width="${w + 2 * e}"/><path d="${f(d)}" stroke="${c.stripe}" stroke-width="${w}"/></g>`;
  const t = theme;
  // tail: tapering peduncle behind the o, then a round caudal fin broader than the peduncle
  const px = 836;
  const pw = p.tailStyle === 'fan' ? 0 : (p.peduncle ?? 80);
  const tx = px + pw;
  const ped = `M${px} ${-150}C${px + 30} ${-142} ${px + 55} ${-128} ${tx} ${-122}L${tx} ${-25}C${px + 55} ${-19} ${px + 30} ${-5} ${px} ${bot}Z`;
  const tl = p.tail ?? 140;
  // fan: flat vertical base right after the o, convex rounded fin (reference picture)
  const bx = tx + 24; // just behind the o
  // concave base (curves into the fin), big round outer edge, slightly pointed tips – like the reference
  const fanTail = `M${bx} ${-172}C${bx + tl * 0.7} ${-188} ${bx + tl + 12} ${-135} ${bx + tl + 12} ${-75}C${bx + tl + 12} ${-15} ${bx + tl * 0.7} ${38} ${bx} ${22}Q${bx + 46} ${-75} ${bx} ${-172}Z`;
  const tail = p.tailStyle === 'fan' ? fanTail : `M${tx - 6} ${-128}C${tx + tl * 0.35} ${-190} ${tx + tl * 0.8} ${-200} ${tx + tl} ${-150}C${tx + tl + 24} ${-110} ${tx + tl + 24} ${-40} ${tx + tl} ${0}C${tx + tl * 0.8} ${50} ${tx + tl * 0.35} ${40} ${tx - 6} ${-20}Z`;
  // dorsal fin above the x-height letters (e, m, o): spiny front, soft round back; the tall N is the head side
  const xh = -150;
  const dTop = xh - (p.dorsal ?? 90);
  const dorsal = `M${232} ${xh + 6}L${270} ${dTop + 30}L${318} ${xh - 40}L${370} ${dTop + 6}L${420} ${xh - 44}L${470} ${dTop}L${520} ${xh - 40}C${600} ${dTop - 4} ${720} ${dTop + 10} ${790} ${xh - 30}C${815} ${xh - 20} ${830} ${xh - 5} ${826} ${xh + 6}Z`;
  // pelvic fin under N/e, anal fin under m/o
  const pelvic = `M${150} ${bot - 10}C${175} ${bot + 70} ${235} ${bot + 80} ${290} ${bot + 40}C${300} ${bot + 25} ${280} ${bot - 5} ${260} ${bot - 10}Z`;
  const anal = `M${560} ${bot - 10}C${600} ${bot + 72} ${700} ${bot + 66} ${760} ${bot + 22}C${770} ${bot + 8} ${750} ${bot - 6} ${730} ${bot - 10}Z`;
  // pectoral fin: small, behind the head band, over the body
  const pect = `M${-10} ${mid + 10}C${20} ${mid + 15} ${70} ${mid + 50} ${60} ${mid + 95}C${30} ${mid + 100} ${-5} ${mid + 70} ${-10} ${mid + 10}Z`;
  // small fins centred on single letters: `dorsalOn` / `ventralOn` name a letter (N, e, m, o)
  const LC = { N: [113, 184], e: [309, 146], m: [524, 231], o: [746, 156] };
  const smallDorsal = (l) => {
    // spiny front (serrated, rising towards the back), soft rounded rear lobe
    const [cx, w] = LC[l];
    const hw = w * (p.finW ?? 0.46);
    const base = l === 'N' ? top : xh;
    const h = p.finH ?? 70;
    const x0 = cx - hw;
    const sp = (i, n) => `L${x0 + (hw * 1.1 * i) / n} ${base - h * (0.45 + (0.4 * i) / n)}L${x0 + (hw * 1.1 * (i + 0.5)) / n} ${base - h * (0.3 + (0.4 * i) / n)}`;
    return `M${x0} ${base + 8}${[0, 1, 2, 3].map((i) => sp(i, 4)).join('')}L${cx + hw * 0.15} ${base - h}C${cx + hw * 0.7} ${base - h * 1.02} ${cx + hw * 1.05} ${base - h * 0.5} ${cx + hw} ${base + 8}Z`;
  };
  const smallVentral = (l) => {
    // rounded lobe, slightly swept back
    const [cx, w] = LC[l];
    const hw = w * (p.finW ?? 0.46) * 0.8;
    const h = p.finH ?? 70;
    return `M${cx - hw} ${bot - 8}C${cx - hw * 1.05} ${bot + h * 0.55} ${cx - hw * 0.4} ${bot + h} ${cx + hw * 0.45} ${bot + h * 0.92}C${cx + hw * 0.95} ${bot + h * 0.8} ${cx + hw * 1.1} ${bot + h * 0.35} ${cx + hw} ${bot - 8}Z`;
  };
  let inner = '';
  if (p.fins === 'all') inner += fin(dorsal) + fin(pelvic) + fin(anal);
  for (const l of [].concat(p.dorsalOn ?? [])) inner += fin(smallDorsal(l));
  for (const l of [].concat(p.ventralOn ?? [])) inner += fin(smallVentral(l));
  if (p.tailStyle === 'fan') {
    inner += `<path d="${f(tail)}" fill="none" stroke="${c.stripe}" stroke-width="${2 * rim}" stroke-linejoin="round"/><path d="${f(tail)}" fill="${c.fish}"/>`;
  } else {
    inner += fin(tail);
    inner += `<path fill="${c.fish}" d="${f(ped)}"/>`;
  }
  inner += word(['N', 'e', 'm', 'o'], p.textLetters ? c.text[theme] : c.fish);
  if (p.diag) {
    // diagonal white stripes with a dark edge across the lettering (candy style), clipped to the letters
    const { w: dw = 26, gap = 70, angle = 62 } = p.diag;
    const k = Math.tan((angle * Math.PI) / 180);
    const seg = (x) => `M${x} ${bot + 40}L${x + (bot + 40 - (top - 40)) / k} ${top - 40}`;
    let edges = '';
    let whites = '';
    for (let x = -400; x < 1100; x += gap) {
      edges += `<path d="${seg(x)}" stroke="${c.edge}" stroke-width="${dw + 2 * e}"/>`;
      whites += `<path d="${seg(x)}" stroke="${c.stripe}" stroke-width="${dw}"/>`;
    }
    inner += `<defs><clipPath id="wm-cl-wc-${t}">${word(['N', 'e', 'm', 'o'], '#000')}</clipPath></defs>`;
    inner += `<g clip-path="url(#wm-cl-wc-${t})" fill="none">${e > 0 ? edges : ''}${whites}</g>`;
  }
  inner += `<path fill="${c.fish}" d="${f(head)}"/>`;
  if (p.pectoral) inner += fin(pect);
  const sx = nose + (p.stripeAt ?? 128);
  const headBand = `M${sx + 8} ${top - 20}Q${sx - 26} ${mid} ${sx + 8} ${bot + 20}`;
  inner += band(`wm-cl-h-${t}`, head, headBand, p.band ?? 32);
  if (p.tailStyle !== 'fan') inner += band(`wm-cl-t-${t}`, ped, `M${px + pw * 0.55} ${-170}L${px + pw * 0.55} ${bot + 20}`, (p.band ?? 32) * 0.8);
  for (const mb of [].concat(p.midBand ?? [])) {
    // band through the body, visible only inside the letters; {x, angle} tilts it
    const mx = typeof mb === 'number' ? mb : mb.x;
    const tilt = typeof mb === 'number' ? 0 : (mb.angle ?? 0);
    const dx = tilt ? (bot - top + 40) * Math.tan((tilt * Math.PI) / 180) / 2 : 0;
    const mbPath = tilt ? `M${mx - dx} ${bot + 20}L${mx + dx} ${top - 20}` : `M${mx + 6} ${top - 20}Q${mx - 14} ${mid} ${mx + 6} ${bot + 20}`;
    inner += `<defs><mask id="wm-cl-mm-${t}-${mx}" maskUnits="userSpaceOnUse" x="${mx - 80}" y="${top - 20}" width="160" height="${bot - top + 40}"><rect x="${mx - 80}" y="${top - 20}" width="160" height="${bot - top + 40}" fill="#000"/>${word(['N', 'e', 'm', 'o'], '#fff')}</mask></defs>`;
    inner += `<g mask="url(#wm-cl-mm-${t}-${mx})" fill="none"><path d="${mbPath}" stroke="${c.edge}" stroke-width="${(p.band ?? 32) + 2 * e}"/><path d="${mbPath}" stroke="${c.stripe}" stroke-width="${p.band ?? 32}"/></g>`;
  }
  inner += `<circle cx="${nose + 58}" cy="${mid - 30}" r="${p.eye}" fill="${c.eye}"/>`;
  const pad = p.pad;
  return wrap([nose - pad - e, Math.min(dTop, top) - pad - e - rim, tx + tl + 26 - nose + 2 * (pad + e + rim), bot + 80 - Math.min(dTop, top) + 2 * (pad + e + rim)], inner);
}

const CONCEPTS = { body, headfin, ofish, swoosh, bones, script, clown };

export function buildWordmark(concept, params = {}, theme = 'light') {
  const p = merge(WM_DEFAULTS, params);
  return CONCEPTS[concept](p, theme);
}
