// Parametric master for the Nemo logo v2: four directions, each drawn from a handful of shapes in a
// 512 x 512 canvas (fish facing right, centred at 256/256). Every direction yields the same set of
// layers so the preview sheet and the asset export treat them alike:
//
//   mark    transparent mark in the accent colour (sidebar, splash, favicon)
//   mono    the same shape in one colour (tray, themed icon, notification icon)
//   app     app icon: the mark on a rounded tile (taskbar, launcher, PWA)
//   adFg    Android adaptive foreground (inside the 66 dp safe zone), adBg background, adMono
//   box     the mark's bounding box inside the 512 canvas (for tight view boxes and the lockup)
//
// Usage: buildLayers(direction, params, { ink, tile }) -> layers. All colours are parameters; the
// defaults are the app's accent tokens (web/src/ui/tokens.css), never the old logo orange.

export const COLORS = {
  // --accent (light / dark), --accent-contrast, --text, surfaces: web/src/ui/tokens.css
  accent: { light: '#b5430c', dark: '#ff9a57' },
  accentContrast: { light: '#ffffff', dark: '#1b0f06' },
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
// Shared fish silhouette (directions A "tile" and D "line"): body lens + tail, stripes and eye.
// ---------------------------------------------------------------------------------------------
export const FISH = {
  body: { nose: 470, joint: 150, height: 112, peak: 0.5, blunt: 0.62, stalk: 44 },
  tail: { style: 'fork', length: 96, spread: 96, notch: 34, overlap: 30 },
  stripes: { at: [0.72, 0.38], width: 38, bend: -10 }, // fractions 0 = tail joint .. 1 = nose
  eye: { at: 0.84, dy: -0.16, r: 22 },
  soften: 12, // rounds every outer corner (same-colour stroke)
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
  const top = `M${x0} ${cy - ph}L${xp} ${cy - ph}C${xp - L * 0.4} ${cy - ph} ${xe + L * 0.3} ${cy - s} ${xe} ${cy - s}`;
  const back =
    t.style === 'fork'
      ? `C${xe + notch * 0.5} ${cy - s * 0.55} ${xe + notch} ${cy - s * 0.2} ${xe + notch} ${cy}C${xe + notch} ${cy + s * 0.2} ${xe + notch * 0.5} ${cy + s * 0.55} ${xe} ${cy + s}`
      : `C${xe - notch} ${cy - s * 0.4} ${xe - notch} ${cy + s * 0.4} ${xe} ${cy + s}`;
  const bottom = `C${xe + L * 0.3} ${cy + s} ${xp - L * 0.4} ${cy + ph} ${xp} ${cy + ph}L${x0} ${cy + ph}Z`;
  return fmt(top + back + bottom);
}
function fishStripes(f, cy = 256) {
  const { nose: xn, joint: xp, height: h } = f.body;
  const reach = h + 60;
  return f.stripes.at.map((a) => {
    const x = xp + (xn - xp) * a;
    return { d: fmt(`M${x} ${cy - reach}Q${x + 2 * f.stripes.bend} ${cy} ${x} ${cy + reach}`), w: f.stripes.width };
  });
}
function fishEye(f, cy = 256) {
  const { nose: xn, joint: xp, height: h } = f.body;
  return { cx: r1(xp + (xn - xp) * f.eye.at), cy: r1(cy + f.eye.dy * h), r: f.eye.r };
}
function fishBox(f, cy = 256) {
  const left = f.body.joint - f.tail.length - f.soften / 2;
  const right = f.body.nose + f.soften / 2;
  const top = cy - Math.max(f.body.height, f.tail.spread) - f.soften / 2;
  const bottom = cy + Math.max(f.body.height, f.tail.spread) + f.soften / 2;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Filled fish with stripes and eye cut out (mask), as an SVG fragment. */
function fishFilled(f, color, id) {
  const stripes = fishStripes(f);
  const eye = fishEye(f);
  const holes =
    stripes.map((s) => `<path d="${s.d}" stroke-width="${s.w}"/>`).join('') +
    (f.eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="#000" stroke="none"/>` : '');
  const defs = holes
    ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/><g fill="none" stroke="#000">${holes}</g></mask>`
    : '';
  const soft = f.soften > 0 ? ` stroke="${color}" stroke-width="${f.soften}" stroke-linejoin="round"` : '';
  const body = `<g fill="${color}"${soft}${holes ? ` mask="url(#${id})"` : ''}><path d="${bodyPath(f.body)}"/><path d="${tailPath(f.body, f.tail)}"/></g>`;
  return { defs, body };
}

// ---------------------------------------------------------------------------------------------
// Direction B "head": only the head (egg shape, nose to the right), one band and the eye.
// ---------------------------------------------------------------------------------------------
export const HEAD = {
  r: 190, // radius of the round back
  egg: 0.18, // 0 = circle, 1 = pointed nose
  band: { at: 0.44, width: 44, bend: -14 }, // 0 = back .. 1 = nose
  eye: { at: 0.73, dy: -0.18, r: 30 },
  mouth: 0, // notch depth at the nose (0 = none)
};
function headPath(hd, cx = 256, cy = 256) {
  const R = hd.r;
  const k = 0.5523; // circle Bézier constant
  const nx = cx + R * (1 + hd.egg * 0.25); // nose x
  const stretch = 1 + hd.egg; // the front half is stretched into an egg
  const nk = k * (1 - hd.egg * 0.5); // smaller = more pointed nose
  return fmt(
    `M${cx} ${cy - R}C${cx - R * k} ${cy - R} ${cx - R} ${cy - R * k} ${cx - R} ${cy}` +
      `C${cx - R} ${cy + R * k} ${cx - R * k} ${cy + R} ${cx} ${cy + R}` +
      `C${cx + R * k * stretch} ${cy + R} ${nx} ${cy + R * nk} ${nx} ${cy}` +
      `C${nx} ${cy - R * nk} ${cx + R * k * stretch} ${cy - R} ${cx} ${cy - R}Z`,
  );
}
function headFilled(hd, color, id, cx = 256, cy = 256) {
  const R = hd.r;
  const nx = cx + R * (1 + hd.egg * 0.25);
  const span = nx - (cx - R);
  const bx = cx - R + span * hd.band.at;
  const band = fmt(`M${bx} ${cy - R - 40}Q${bx + 2 * hd.band.bend} ${cy} ${bx} ${cy + R + 40}`);
  const eye = { cx: r1(cx - R + span * hd.eye.at), cy: r1(cy + hd.eye.dy * R), r: hd.eye.r };
  const defs = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/><path d="${band}" fill="none" stroke="#000" stroke-width="${hd.band.width}"/>${hd.eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="#000"/>` : ''}${hd.mouth > 0 ? `<path d="M${nx + 10} ${cy}L${nx - hd.mouth} ${cy}" stroke="#000" stroke-width="${hd.band.width * 0.6}" stroke-linecap="round"/>` : ''}</mask>`;
  const body = `<path d="${headPath(hd, cx, cy)}" fill="${color}" mask="url(#${id})"/>`;
  const box = { x: cx - R, y: cy - R, w: span, h: 2 * R };
  return { defs, body, box };
}

// ---------------------------------------------------------------------------------------------
// Direction C "bands": stripes and fin as geometry – a stadium body split by slanted gaps into
// three bands, a forked fin; with slant it reads almost like an italic N or a wave.
// ---------------------------------------------------------------------------------------------
export const BANDS = {
  nose: 462,
  joint: 150,
  height: 118, // half height at the head
  stalk: 56, // half height at the tail joint
  gaps: { at: [0.66, 0.36], width: 36, slant: 18 }, // slant in degrees, + = top leans to the head
  fin: { length: 90, spread: 96, notch: 30 },
  eye: { at: 0.83, dy: -0.2, r: 0 }, // r 0 = no eye (pure geometry)
  soften: 14,
};
function bandsFilled(bd, color, id, cy = 256) {
  const { nose: xn, joint: xp, height: h, stalk: ph } = bd;
  const k = 0.5523;
  // Head = semicircle of radius h; top and bottom edges taper straight to the tail joint.
  const hx = xn - h;
  const body = fmt(
    `M${xp} ${cy - ph}L${hx} ${cy - h}C${hx + h * k} ${cy - h} ${xn} ${cy - h * k} ${xn} ${cy}` +
      `C${xn} ${cy + h * k} ${hx + h * k} ${cy + h} ${hx} ${cy + h}L${xp} ${cy + ph}Z`,
  );
  const { length: L, spread: s, notch } = bd.fin;
  const xe = xp - L;
  const fin = fmt(
    `M${xp + 24} ${cy - ph}L${xp} ${cy - ph}L${xe} ${cy - s}L${xe + notch} ${cy}L${xe} ${cy + s}L${xp} ${cy + ph}L${xp + 24} ${cy + ph}Z`,
  );
  const tan = Math.tan((bd.gaps.slant * Math.PI) / 180);
  const reach = h + 80;
  const gaps = bd.gaps.at.map((a) => {
    const x = xp + (xn - xp) * a;
    return fmt(`M${x + reach * tan} ${cy - reach}L${x - reach * tan} ${cy + reach}`);
  });
  const eye = { cx: r1(xp + (xn - xp) * bd.eye.at), cy: r1(cy + bd.eye.dy * h), r: bd.eye.r };
  const defs = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/><g fill="none" stroke="#000" stroke-width="${bd.gaps.width}">${gaps.map((d) => `<path d="${d}"/>`).join('')}</g>${eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="#000"/>` : ''}</mask>`;
  const soft = bd.soften > 0 ? ` stroke="${color}" stroke-width="${bd.soften}" stroke-linejoin="round"` : '';
  const out = `<g fill="${color}"${soft} mask="url(#${id})"><path d="${body}"/><path d="${fin}"/></g>`;
  const box = { x: xe - bd.soften / 2, y: cy - Math.max(h, s) - bd.soften / 2, w: xn - xe + bd.soften, h: 2 * Math.max(h, s) + bd.soften };
  return { defs, body: out, box };
}

// ---------------------------------------------------------------------------------------------
// Direction D "line": the fish as an outline in the icon set's stroke (Lucide: 1.5 on a 24 grid
// = 32 units here; 1.75 at 16 px = 37), round caps and joins, the eye as a dot.
// ---------------------------------------------------------------------------------------------
export const LINE = {
  stroke: 34,
  body: { nose: 452, joint: 170, height: 104, peak: 0.5, blunt: 0.62, stalk: 40 },
  tail: { length: 92, spread: 90, notch: 30 },
  stripes: { at: [0.7], width: 0, bend: -10, inset: 0.78 }, // inset: how far a stripe line reaches up/down (fraction of the local height)
  eye: { at: 0.83, dy: -0.18, r: 1.15 }, // r as a multiple of the stroke
};
function lineDrawn(ln, color) {
  const cy = 256;
  const b = ln.body;
  const w = ln.stroke;
  const { nose: xn, joint: xp, height: h, stalk: ph } = b;
  const body = bodyPath(b, cy);
  // Tail: two open strokes from the joint to the tips, joined by the notch.
  const { length: L, spread: s, notch } = ln.tail;
  const xe = xp - L;
  const tail = fmt(
    `M${xp} ${cy - ph}C${xp - L * 0.4} ${cy - ph} ${xe + L * 0.3} ${cy - s} ${xe} ${cy - s}` +
      `C${xe + notch * 0.5} ${cy - s * 0.55} ${xe + notch} ${cy - s * 0.2} ${xe + notch} ${cy}` +
      `C${xe + notch} ${cy + s * 0.2} ${xe + notch * 0.5} ${cy + s * 0.55} ${xe} ${cy + s}` +
      `C${xe + L * 0.3} ${cy + s} ${xp - L * 0.4} ${cy + ph} ${xp} ${cy + ph}`,
  );
  const stripes = ln.stripes.at.map((a) => {
    const x = xp + (xn - xp) * a;
    const hh = h * ln.stripes.inset;
    return fmt(`M${x} ${cy - hh}Q${x + 2 * ln.stripes.bend} ${cy} ${x} ${cy + hh}`);
  });
  const eye = { cx: r1(xp + (xn - xp) * ln.eye.at), cy: r1(cy + ln.eye.dy * h), r: r1(ln.eye.r * w) };
  const out =
    `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${body}"/><path d="${tail}"/>${stripes.map((d) => `<path d="${d}"/>`).join('')}</g>` +
    (ln.eye.r > 0 ? `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="${color}"/>` : '');
  const box = { x: xe - w / 2, y: cy - Math.max(h, s) - w / 2, w: xn - xe + w, h: 2 * Math.max(h, s) + w };
  return { defs: '', body: out, box };
}

// ---------------------------------------------------------------------------------------------
// Views: tile (app icon), adaptive, transparent mark.
// ---------------------------------------------------------------------------------------------
export const VIEWS = {
  tile: { radius: 146, scale: 0.8, dx: 0, dy: 0 }, // radius 146/512 = the module chip's 8/28
  adaptive: { scale: 0.62, dx: 0, dy: 0 }, // Android: 512 box = 108 dp, safe circle r 156
  mark: { scale: 1, dx: 0, dy: 0 },
};
const place = (v) => `translate(${r1(256 * (1 - v.scale) + (v.dx ?? 0))} ${r1(256 * (1 - v.scale) + (v.dy ?? 0))}) scale(${v.scale})`;

const DIRECTIONS = {
  tile: { base: FISH, draw: (p, color, id) => ({ ...fishFilled(p, color, id), box: fishBox(p) }) },
  head: { base: HEAD, draw: (p, color, id) => headFilled(p, color, id) },
  bands: { base: BANDS, draw: (p, color, id) => bandsFilled(p, color, id) },
  line: { base: LINE, draw: (p, color) => lineDrawn(p, color) },
};
export const DIRECTION_IDS = Object.keys(DIRECTIONS);

/**
 * Builds every layer of one direction.
 *   params: overrides of the direction's base parameters (plus optional `views`)
 *   opts.ink:  colours { mark, mono, tile, onTile } – defaults: accent light, black, accent light, white
 */
export function buildLayers(direction, params = {}, opts = {}) {
  const dir = DIRECTIONS[direction];
  if (!dir) throw new Error(`unknown direction ${direction}`);
  const { views: viewsOver, ...shapeOver } = params;
  const p = merge(dir.base, shapeOver);
  const views = merge(VIEWS, viewsOver ?? {});
  const ink = merge({ mark: COLORS.accent.light, mono: '#000000', tile: COLORS.accent.light, onTile: '#ffffff' }, opts.ink ?? {});
  const uid = opts.id ?? `nemo-${direction}`;
  const draw = (color, id, view) => {
    const d = dir.draw(p, color, id);
    return { defs: d.defs, body: `<g transform="${place(view)}">${d.body}</g>`, box: d.box };
  };
  const m = draw(ink.mark, `${uid}-m`, views.mark);
  const mono = draw(ink.mono, `${uid}-o`, views.mark);
  const t = draw(ink.onTile, `${uid}-t`, views.tile);
  const a = draw(ink.onTile, `${uid}-a`, views.adaptive);
  const am = draw('#ffffff', `${uid}-am`, views.adaptive);
  const box = m.box;
  const tight = `${Math.floor(box.x)} ${Math.floor(box.y)} ${Math.ceil(box.w) + 1} ${Math.ceil(box.h) + 1}`;
  const side = Math.ceil(Math.max(box.w, box.h) * 1.06);
  const square = `${r1(box.x + box.w / 2 - side / 2)} ${r1(box.y + box.h / 2 - side / 2)} ${side} ${side}`;
  return {
    direction,
    params: p,
    views,
    ink,
    box,
    tight,
    square,
    mark: svg(`<defs>${m.defs}</defs>${m.body}`, 'Nemo', tight),
    markSquare: svg(`<defs>${m.defs}</defs>${m.body}`, 'Nemo', square),
    mono: svg(`<defs>${mono.defs}</defs>${mono.body}`, 'Nemo', square),
    app: svg(`<defs>${t.defs}</defs><rect width="512" height="512" rx="${views.tile.radius}" fill="${ink.tile}"/>${t.body}`),
    appSmall: svg(`<defs>${t.defs}</defs><rect width="512" height="512" rx="${Math.round(views.tile.radius * 0.85)}" fill="${ink.tile}"/>${t.body}`),
    adFg: svg(`<defs>${a.defs}</defs>${a.body}`),
    adBg: svg(`<rect width="512" height="512" fill="${ink.tile}"/>`),
    adMono: svg(`<defs>${am.defs}</defs>${am.body}`),
    /** The mark recoloured (same geometry); for palette checks. */
    markIn: (color) => svg(`<defs>${draw(color, `${uid}-x`, views.mark).defs}</defs>${draw(color, `${uid}-x`, views.mark).body}`, 'Nemo', tight),
  };
}

/** Largest distance of the mark's box corners from the centre after `scale` (safe-zone check). */
export function reach(box, scale = 1, dx = 0, dy = 0) {
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot((x - 256) * scale + dx, (y - 256) * scale + dy)));
}
