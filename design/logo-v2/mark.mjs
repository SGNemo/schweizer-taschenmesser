// Parametric master of the Nemo mark: a stylised clownfish drawn from a handful of shapes (body, tail,
// optional fins, two bands, one eye) in a 512 x 512 canvas, fish facing right, centred at 256/256.
// Every parameter lives in `final.params.mjs` (the chosen set) or in a round's `variants.mjs`.
//
// buildLayers(params, opts) returns the layers the preview sheets use (the brand export in `export.mjs`
// writes its own files from `markGeometry`, so that every file shares identical path strings):
//
//   mark / markSquare   transparent mark in the accent colour (tight / square view box)
//   mono                the same shape in one colour (tray, themed icon, notification icon)
//   app / appSmall      app icon: the mark on a rounded tile (taskbar, launcher, PWA), small-size corners;
//                       `views.tile.style: 'duo'` = the fish in the accent with white filled bands on the ocean gradient
//   adFg adBg adMono    Android adaptive foreground / background / monochrome (66 dp safe zone)
//   markIn(color)       the mark in any colour or CSS variable (lockups, palette checks)
//   box / tight         the mark's exact bounding box inside the 512 canvas
//
// Colours default to the app's accent tokens (web/src/ui/tokens.css), never to a hand-picked orange.

export const COLORS = {
  // --accent (light / dark), --accent-contrast, --text, surfaces: web/src/ui/tokens.css
  accent: { light: '#b5430c', dark: '#ff9a57' },
  accentHover: { light: '#963709', dark: '#ffb07a' },
  accentContrast: { light: '#ffffff', dark: '#1b0f06' },
  // --ocean-from / --ocean-to: the brand gradient (same value in both themes), the tile of the two-colour app icon
  ocean: { from: '#1d6b7a', to: '#0e2f45' },
  accentSoft: { light: '#fbe9de', dark: '#2e241c' },
  text: { light: '#171f24', dark: '#eceff1' },
  text3: { light: '#5f6c75', dark: '#88939b' },
  surface: { light: '#ffffff', dark: '#171c20' },
  surface2: { light: '#eaecee', dark: '#1f2529' },
  bg: { light: '#f3f4f4', dark: '#0f1316' },
  // module palette --mod-* (light / dark)
  mod: {
    sky: ['#1f5fa8', '#7cc7e8'],
    moss: ['#4f6d1a', '#a9d26f'],
    teal: ['#12766f', '#4fb3ad'],
    ocean: ['#1d6b7a', '#6fd6d0'],
    violet: ['#7a4aa8', '#c9a8ea'],
    plum: ['#a0305f', '#f0a0c0'],
    orchid: ['#8a3a8f', '#e3a3e0'],
    indigo: ['#4a52b8', '#a7adf5'],
    slate: ['#55636b', '#a9b7c0'],
    navy: ['#2b3f8c', '#9db0f0'],
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  return out;
}
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (s) => s.replace(/-?\d+\.\d+/g, (m) => String(r1(Number(m))));
const svg = (inner, label = 'Nemo', viewBox = '0 0 512 512') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">${inner}</svg>\n`;

// ---------------------------------------------------------------------------------------------
// The fish: body lens + tail (+ fins), bands and eye.
// ---------------------------------------------------------------------------------------------
export const FISH = {
  body: { nose: 470, joint: 150, height: 112, peak: 0.5, blunt: 0.62, stalk: 44 },
  tail: { style: 'fork', length: 96, spread: 96, notch: 34, overlap: 30 }, // style: fan | fork | lobe
  // fractions 0 = tail joint .. 1 = nose; width and bend may be arrays. rim > 0: the cut bands stop before the body
  // outline (a rim of rim / 2 stays), so the one-colour fish remains one piece instead of three.
  stripes: { at: [0.72, 0.38], width: 38, bend: -10, rim: 0 },
  eye: { at: 0.84, dy: -0.16, r: 22 },
  fins: { dorsal: { height: 0, from: 0.3, to: 0.7 }, ventral: { height: 0, from: 0.38, to: 0.6 } }, // height 0 = none
  soften: 12, // rounds every outer corner (same-colour stroke)
  tilt: 0, // degrees, negative = nose up
};

function bodyPath(b, cy = 256) {
  const { nose: xn, joint: xp, height: h, peak, blunt: k, stalk: ph } = b;
  const xm = xp + (xn - xp) * peak;
  const d1 = xm - xp;
  const d2 = xn - xm;
  return fmt(
    `M${xp} ${cy - ph}C${xp + d1 * 0.32} ${cy - ph - (h - ph) * 0.5} ${xm - d1 * 0.42} ${cy - h} ${xm} ${cy - h}` +
      `C${xm + d2 * k} ${cy - h} ${xn} ${cy - h * k} ${xn} ${cy}` +
      `C${xn} ${cy + h * k} ${xm + d2 * k} ${cy + h} ${xm} ${cy + h}` +
      `C${xm - d1 * 0.42} ${cy + h} ${xp + d1 * 0.32} ${cy + ph + (h - ph) * 0.5} ${xp} ${cy + ph}Z`,
  );
}
function tailPath(b, t, cy = 256) {
  const { joint: xp, stalk: ph } = b;
  const { length: L, spread: s, notch, overlap: ov } = t;
  const x0 = xp + ov;
  const xe = xp - L;
  if (t.style === 'lobe') {
    // Two rounded lobes and a shallow notch (v2.1): the tips are drawn round instead of relying on the soften
    // stroke, so the tail reads as a fin at 16 px and not as two spikes.
    const r = L * 0.23; // tip rounding
    const half = (d) =>
      `C${xp - L * 0.3} ${cy + d * (ph + s * 0.1)} ${xp - L * 0.56} ${cy + d * s * 0.87} ${xe + r} ${cy + d * s}` +
      `C${xe + r * 0.15} ${cy + d * s * 1.07} ${xe - r * 0.34} ${cy + d * s * 0.92} ${xe - r * 0.08} ${cy + d * s * 0.68}`;
    // top lobe forwards (joint → tip → notch), bottom lobe is its mirror image walked backwards
    const top = `M${x0} ${cy - ph}L${xp} ${cy - ph}${half(-1)}C${xe + r * 0.17} ${cy - s * 0.45} ${xe + notch} ${cy - s * 0.21} ${xe + notch} ${cy}`;
    const bottom =
      `C${xe + notch} ${cy + s * 0.21} ${xe + r * 0.17} ${cy + s * 0.45} ${xe - r * 0.08} ${cy + s * 0.68}` +
      `C${xe - r * 0.34} ${cy + s * 0.92} ${xe + r * 0.15} ${cy + s * 1.07} ${xe + r} ${cy + s}` +
      `C${xp - L * 0.56} ${cy + s * 0.87} ${xp - L * 0.3} ${cy + ph + s * 0.1} ${xp} ${cy + ph}L${x0} ${cy + ph}Z`;
    return fmt(top + bottom);
  }
  const top = `M${x0} ${cy - ph}L${xp} ${cy - ph}C${xp - L * 0.4} ${cy - ph} ${xe + L * 0.3} ${cy - s} ${xe} ${cy - s}`;
  const back =
    t.style === 'fork'
      ? `C${xe + notch * 0.5} ${cy - s * 0.55} ${xe + notch} ${cy - s * 0.2} ${xe + notch} ${cy}C${xe + notch} ${cy + s * 0.2} ${xe + notch * 0.5} ${cy + s * 0.55} ${xe} ${cy + s}`
      : `C${xe - notch} ${cy - s * 0.4} ${xe - notch} ${cy + s * 0.4} ${xe} ${cy + s}`;
  const bottom = `C${xe + L * 0.3} ${cy + s} ${xp - L * 0.4} ${cy + ph} ${xp} ${cy + ph}L${x0} ${cy + ph}Z`;
  return fmt(top + back + bottom);
}
function finPath(b, f, dir, cy = 256) {
  if (!f || !f.height) return '';
  const { nose: xn, joint: xp, height: h } = b;
  const x1 = xp + (xn - xp) * f.from;
  const x2 = xp + (xn - xp) * f.to;
  const w = x2 - x1;
  const base = cy + dir * h * 0.55;
  const tip = cy + dir * (h + f.height);
  const xpk = x1 + w * 0.45;
  return fmt(
    `M${x1} ${base}C${x1 + w * 0.05} ${tip} ${xpk - w * 0.15} ${tip} ${xpk} ${tip}` +
      `C${xpk + w * 0.35} ${tip} ${x2} ${cy + dir * h * 0.92} ${x2} ${base}Z`,
  );
}
function fishShapes(f) {
  return [bodyPath(f.body), tailPath(f.body, f.tail), finPath(f.body, f.fins?.dorsal, -1), finPath(f.body, f.fins?.ventral, 1)].filter(Boolean);
}
function fishStripes(f, cy = 256) {
  const { nose: xn, joint: xp, height: h } = f.body;
  const reach = h + 60;
  return f.stripes.at.map((a, i) => {
    const x = xp + (xn - xp) * a;
    const w = Array.isArray(f.stripes.width) ? (f.stripes.width[i] ?? f.stripes.width.at(-1)) : f.stripes.width;
    const bend = Array.isArray(f.stripes.bend) ? (f.stripes.bend[i] ?? f.stripes.bend.at(-1)) : f.stripes.bend;
    return { d: fmt(`M${x} ${cy - reach}Q${x + 2 * bend} ${cy} ${x} ${cy + reach}`), w };
  });
}
function fishEye(f, cy = 256) {
  const { nose: xn, joint: xp, height: h } = f.body;
  return { cx: r1(xp + (xn - xp) * f.eye.at), cy: r1(cy + f.eye.dy * h), r: f.eye.r };
}

/**
 * Points along an absolute M/L/C/Q/Z path (bounding boxes, safe-zone checks). The control points of a
 * curve are not on it, so the box must come from sampled points: the fan tail's convex back edge
 * reaches further out than a box built from the tail length.
 */
export function pathPoints(d, steps = 48) {
  const pts = [];
  const toks = [...d.matchAll(/([MLCQZ])|(-?\d*\.?\d+)/g)].map((m) => m[1] ?? Number(m[2]));
  let i = 0;
  let cur = [0, 0];
  let start = [0, 0];
  const num = () => toks[i++];
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') {
      cur = start = [num(), num()];
      pts.push(cur);
    } else if (c === 'L') {
      cur = [num(), num()];
      pts.push(cur);
    } else if (c === 'C' || c === 'Q') {
      const n = c === 'C' ? 3 : 2;
      const p = [cur];
      for (let k = 0; k < n; k++) p.push([num(), num()]);
      for (let st = 1; st <= steps; st++) {
        const t = st / steps;
        const u = 1 - t;
        const x = n === 3 ? u ** 3 * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t ** 3 * p[3][0] : u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0];
        const y = n === 3 ? u ** 3 * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t ** 3 * p[3][1] : u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1];
        pts.push([x, y]);
      }
      cur = p[n];
    } else if (c === 'Z') {
      cur = start;
    }
  }
  return pts;
}

/** Outline points of every shape of the fish (without the soften stroke). */
function fishOutline(f) {
  return fishShapes(f).flatMap((d) => pathPoints(d));
}

/** Exact bounding box of the fish including the soften stroke (sampled, not estimated). */
function fishBox(f) {
  const pts = fishOutline(f);
  const pad = f.soften / 2;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Filled fish with the bands and the eye cut out (mask), as an SVG fragment. */
function fishFilled(f, color, id) {
  const stripes = fishStripes(f);
  const eye = fishEye(f);
  const rim = f.stripes.rim ?? 0;
  const bands = stripes.map((s) => `<path d="${s.d}" stroke-width="${s.w}"/>`).join('');
  const eyeHole = f.eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="#000" stroke="none"/>` : '';
  const holes = bands + eyeHole;
  const body0 = bodyPath(f.body);
  // rim: the bands are cut inside the body only, and a white stroke on the body outline puts the rim back
  const cut = rim > 0 ? `<g fill="none" stroke="#000" clip-path="url(#${id}-b)">${bands}</g><path d="${body0}" fill="none" stroke="#fff" stroke-width="${rim}" stroke-linejoin="round"/>${eyeHole}` : `<g fill="none" stroke="#000">${holes}</g>`;
  const defs = holes
    ? `${rim > 0 ? `<clipPath id="${id}-b"><path d="${body0}"/></clipPath>` : ''}<mask id="${id}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/>${cut}</mask>`
    : '';
  const soft = f.soften > 0 ? ` stroke="${color}" stroke-width="${f.soften}" stroke-linejoin="round"` : '';
  const body = `<g fill="${color}"${soft}${holes ? ` mask="url(#${id})"` : ''}>${fishShapes(f).map((d) => `<path d="${d}"/>`).join('')}</g>`;
  return { defs, body, box: fishBox(f) };
}

/**
 * Two-colour fish for the app icon: the whole fish in the accent (a soft top-to-bottom gradient of two accent
 * tokens), the bands as white strokes clipped to the body (filled, not cut: the fish stays one piece at 16 px),
 * the eye in the dark end of the ocean gradient.
 */
function fishDuo(f, id, ink) {
  const stripes = fishStripes(f);
  const eye = fishEye(f);
  const box = fishBox(f);
  const defs =
    `<linearGradient id="${id}-f" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(box.y)}" x2="0" y2="${r1(box.y + box.h)}"><stop offset="0" stop-color="${ink.fishTop}"/><stop offset="1" stop-color="${ink.fish}"/></linearGradient>` +
    `<clipPath id="${id}-b"><path d="${bodyPath(f.body)}"/></clipPath>`;
  const soft = f.soften > 0 ? ` stroke="url(#${id}-f)" stroke-width="${f.soften}" stroke-linejoin="round"` : '';
  const body =
    `<g fill="url(#${id}-f)"${soft}>${fishShapes(f).map((d) => `<path d="${d}"/>`).join('')}</g>` +
    `<g fill="none" stroke="${ink.band}" clip-path="url(#${id}-b)">${stripes.map((s) => `<path d="${s.d}" stroke-width="${s.w}"/>`).join('')}</g>` +
    (f.eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="${ink.eye}"/>` : '');
  return { defs, body, box };
}
// Top to bottom, not diagonal: every pixel row is one colour, so the PNG icons stay small (a diagonal
// gradient made pwa-512.png six times larger and broke the precache budget).
export const oceanGradient = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.ocean.from}"/><stop offset="1" stop-color="${COLORS.ocean.to}"/></linearGradient>`;

// ---------------------------------------------------------------------------------------------
// Views: tile (app icon), adaptive, transparent mark.
// ---------------------------------------------------------------------------------------------
export const VIEWS = {
  // radius 146/512 = the module chip's 8/28; clip: the mark may bleed off the tile; style: mono (one colour on the
  // accent tile) | duo (accent fish, white bands, ocean gradient tile – also the Android adaptive layers)
  tile: { radius: 146, scale: 0.8, dx: 0, dy: 0, clip: false, style: 'mono' },
  adaptive: { scale: 0.62, dx: 0, dy: 0 }, // Android: 512 box = 108 dp, safe circle r 156
  mark: { scale: 1, dx: 0, dy: 0 },
};
const place = (v) => `translate(${r1(256 * (1 - v.scale) + (v.dx ?? 0))} ${r1(256 * (1 - v.scale) + (v.dy ?? 0))}) scale(${v.scale})`;

/**
 * Builds every layer of the mark.
 *   params: overrides of FISH (plus optional `views`)
 *   opts.ink: colours { mark, mono, tile, onTile } – defaults: accent light, black, accent light, white
 *   opts.id:  prefix of the SVG ids (unique per file when several are inlined)
 */
export function buildLayers(params = {}, opts = {}) {
  const { views: viewsOver, ...shapeOver } = params;
  const p = merge(FISH, shapeOver);
  const views = merge(VIEWS, viewsOver ?? {});
  const ink = merge(
    { mark: COLORS.accent.light, mono: '#000000', tile: COLORS.accent.light, onTile: '#ffffff', fish: COLORS.accent.dark, fishTop: COLORS.accentHover.dark, band: '#ffffff', eye: COLORS.ocean.to },
    opts.ink ?? {},
  );
  const duo = views.tile.style === 'duo';
  const uid = opts.id ?? 'nemo';
  const tilt = p.tilt ?? 0;
  const draw = (color, id, view) => {
    const d = fishFilled(p, color, id);
    const inner = tilt ? `<g transform="rotate(${tilt} 256 256)">${d.body}</g>` : d.body;
    return { defs: d.defs, body: `<g transform="${place(view)}">${inner}</g>`, box: tilt ? rotateBox(d.box, tilt) : d.box };
  };
  const m = draw(ink.mark, `${uid}-m`, views.mark);
  const mono = draw(ink.mono, `${uid}-o`, views.mark);
  const drawDuo = (id, view) => {
    const d = fishDuo(p, id, ink);
    return { defs: d.defs, body: `<g transform="${place(view)}">${d.body}</g>`, box: d.box };
  };
  const t = duo ? drawDuo(`${uid}-t`, views.tile) : draw(ink.onTile, `${uid}-t`, views.tile);
  const a = duo ? drawDuo(`${uid}-a`, views.adaptive) : draw(ink.onTile, `${uid}-a`, views.adaptive);
  if (duo) t.defs += oceanGradient(`${uid}-o`);
  const tileFill = duo ? `url(#${uid}-o)` : ink.tile;
  const am = draw('#ffffff', `${uid}-am`, views.adaptive);
  const box = m.box;
  const tight = `${Math.floor(box.x)} ${Math.floor(box.y)} ${Math.ceil(box.w) + 1} ${Math.ceil(box.h) + 1}`;
  const side = Math.ceil(Math.max(box.w, box.h) * 1.06);
  const square = `${r1(box.x + box.w / 2 - side / 2)} ${r1(box.y + box.h / 2 - side / 2)} ${side} ${side}`;
  return {
    params: p,
    views,
    ink,
    box,
    tight,
    square,
    mark: svg(`<defs>${m.defs}</defs>${m.body}`, 'Nemo', tight),
    markSquare: svg(`<defs>${m.defs}</defs>${m.body}`, 'Nemo', square),
    mono: svg(`<defs>${mono.defs}</defs>${mono.body}`, 'Nemo', square),
    app: tileSvg(t, views.tile.radius, tileFill, views.tile.clip, `${uid}-clip`),
    appSmall: tileSvg(t, Math.round(views.tile.radius * 0.85), tileFill, views.tile.clip, `${uid}-clips`),
    adFg: svg(`<defs>${a.defs}</defs>${a.body}`),
    adBg: duo ? svg(`<defs>${oceanGradient(`${uid}-ob`)}</defs><rect width="512" height="512" fill="url(#${uid}-ob)"/>`) : svg(`<rect width="512" height="512" fill="${ink.tile}"/>`),
    adMono: svg(`<defs>${am.defs}</defs>${am.body}`),
    /** The mark recoloured (same geometry): any colour or a CSS variable. */
    markIn: (color) => {
      const x = draw(color, `${uid}-x`, views.mark);
      return svg(`<defs>${x.defs}</defs>${x.body}`, 'Nemo', tight);
    },
  };
}

function tileSvg(t, radius, fill, clip, id) {
  const rect = `<rect width="512" height="512" rx="${radius}" fill="${fill}"/>`;
  if (!clip) return svg(`<defs>${t.defs}</defs>${rect}${t.body}`);
  return svg(`<defs>${t.defs}<clipPath id="${id}"><rect width="512" height="512" rx="${radius}"/></clipPath></defs>${rect}<g clip-path="url(#${id})">${t.body}</g>`);
}

/**
 * The raw geometry of the mark in the 512 canvas for the brand export: body, the other shapes (tail and
 * fins), the band centre lines with their widths, the eye, the soften stroke and the exact box;
 * `radius(scale, dx, dy)` is the largest distance of the outline from the centre (soften included) after
 * a view transform – the maskable and adaptive safe-zone checks use it.
 */
export function markGeometry(params = {}) {
  const p = merge(FISH, params);
  if (p.tilt) throw new Error('markGeometry: the final mark is not tilted');
  const shapes = fishShapes(p);
  const pts = fishOutline(p);
  const pad = p.soften / 2;
  return {
    params: p,
    body: shapes[0],
    rest: shapes.slice(1),
    cuts: fishStripes(p),
    rim: p.stripes.rim ?? 0,
    eye: fishEye(p),
    soften: p.soften,
    box: fishBox(p),
    radius: (scale = 1, dx = 0, dy = 0) => Math.max(...pts.map(([x, y]) => Math.hypot((x - 256) * scale + dx, (y - 256) * scale + dy))) + pad * scale,
  };
}

/** Axis-aligned box of a box rotated by `deg` around (256, 256). */
function rotateBox(b, deg) {
  const a = (deg * Math.PI) / 180;
  const pts = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ].map(([x, y]) => [256 + (x - 256) * Math.cos(a) - (y - 256) * Math.sin(a), 256 + (x - 256) * Math.sin(a) + (y - 256) * Math.cos(a)]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Largest distance of the mark's box corners from the centre after `scale` (a quick safe-zone estimate for the sheets). */
export function reach(box, scale = 1, dx = 0, dy = 0) {
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot((x - 256) * scale + dx, (y - 256) * scale + dy)));
}
