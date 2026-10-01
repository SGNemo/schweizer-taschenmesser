// Parametric master SVG for the Nemo app icon: a generic, stylised clownfish
// built from a handful of shapes (body, tail, optional fins, stripes, eye).
//
// Every output is a standalone 512 x 512 SVG string. All geometry lives in one
// 512 box with the fish facing right; "views" (scale / offset / tilt) place it
// on a plate, in the Android adaptive canvas or in the monochrome variant.
//
// Usage: buildLayers(params) -> { full, mark, mono, adFg, adBg, adMono, params }

export const DEFAULTS = {
  body: {
    nose: 452, // x of the snout tip
    peduncle: 150, // x where body meets tail
    cy: 256, // vertical centre
    height: 116, // half height at the widest point
    peak: 0.52, // where the widest point sits (0 = tail joint, 1 = nose)
    blunt: 0.6, // snout roundness (0.55 ~ ellipse, higher = blunter)
    stalk: 50, // half height of the tail joint
  },
  tail: {
    style: 'fan', // fan | fork | triangle | none
    length: 82,
    spread: 84, // half height at the tail tips
    bulge: 18, // fan: convex back edge; fork: notch depth
    overlap: 24, // how far the tail reaches into the body
  },
  dorsal: { height: 0, from: 0.3, to: 0.72 }, // height 0 = no fin
  ventral: { height: 0, from: 0.4, to: 0.62 },
  soften: 0, // rounds all outer corners (px, same-colour stroke)
  tilt: 0, // degrees
  stripes: {
    at: [0.78, 0.42, 0.04], // positions, 0 = tail joint, 1 = nose
    width: 40, // number or array per stripe
    bend: [-14, -10, 0], // midpoint offset, + = bows towards the head
    edge: 0, // dark border on each side of a stripe (px)
    mode: 'white', // white = painted bands, cut = holes (show the plate)
  },
  eye: { at: 0.86, dy: -0.22, r: 16, style: 'dot', ring: 0 }, // style: dot | cut | none
  outline: 0, // dark outline around the whole silhouette (px)
  colors: { body: '#F26A1E', stripe: '#FFFFFF', edge: '#14202B', eye: '#14202B' },
  plate: {
    shape: 'rounded', // rounded | circle | squircle | none
    radius: 112,
    fill: { from: '#1D6B7A', to: '#0E2F45' }, // colour string or gradient
    scale: 0.74,
    dx: 0,
    dy: 0,
    clip: false, // clip the fish to the plate (for crops)
    stroke: null, // { color, width } inner border, helps dark plates on dark taskbars
  },
  mark: { scale: 1, dx: 0, dy: 0, colors: null }, // transparent mark (logo-mark.svg); colors overrides for it
  adaptive: { bg: null, scale: 0.62, dx: 0, dy: 0 }, // Android: 512 box = 108 dp canvas
  mono: { style: 'mark', scale: 1, dx: 0, dy: 0 }, // mark | negative (plate with fish cut out)
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  return out;
}

const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (s) => s.replace(/-?\d+\.\d+/g, (m) => String(r2(Number(m))));

// ---------- geometry ----------
function bodyPath(b) {
  const { nose: xn, peduncle: xp, cy, height: h, peak, blunt: k, stalk: ph } = b;
  const xm = xp + (xn - xp) * peak;
  const d1 = xm - xp;
  const d2 = xn - xm;
  return fmt(
    `M${xp} ${cy - ph}C${xp + d1 * 0.3} ${cy - ph - (h - ph) * 0.45} ${xm - d1 * 0.45} ${cy - h} ${xm} ${cy - h}` +
      `C${xm + d2 * k} ${cy - h} ${xn} ${cy - h * k} ${xn} ${cy}` +
      `C${xn} ${cy + h * k} ${xm + d2 * k} ${cy + h} ${xm} ${cy + h}` +
      `C${xm - d1 * 0.45} ${cy + h} ${xp + d1 * 0.3} ${cy + ph + (h - ph) * 0.45} ${xp} ${cy + ph}Z`,
  );
}

function tailPath(b, t) {
  if (t.style === 'none') return '';
  const { peduncle: xp, cy, stalk: ph } = b;
  const { length: L, spread: s, bulge, overlap: ov } = t;
  const x0 = xp + ov;
  const xe = xp - L;
  if (t.style === 'triangle') return fmt(`M${x0} ${cy}L${xe} ${cy - s}L${xe} ${cy + s}Z`);
  const top = `M${x0} ${cy - ph}C${xp - L * 0.3} ${cy - ph} ${xe + L * 0.15} ${cy - s} ${xe} ${cy - s}`;
  const back =
    t.style === 'fork'
      ? `L${xe + bulge} ${cy}L${xe} ${cy + s}`
      : `C${xe - bulge} ${cy - s * 0.45} ${xe - bulge} ${cy + s * 0.45} ${xe} ${cy + s}`;
  const bottom = `C${xe + L * 0.15} ${cy + s} ${xp - L * 0.3} ${cy + ph} ${x0} ${cy + ph}Z`;
  return fmt(top + back + bottom);
}

function finPath(b, f, dir) {
  if (!f.height) return '';
  const { nose: xn, peduncle: xp, cy, height: h } = b;
  const x1 = xp + (xn - xp) * f.from;
  const x2 = xp + (xn - xp) * f.to;
  const w = x2 - x1;
  const base = cy + dir * h * 0.5;
  const tip = cy + dir * (h + f.height);
  const xpk = x1 + w * 0.4;
  return fmt(
    `M${x1} ${base}C${x1} ${tip} ${xpk - w * 0.2} ${tip} ${xpk} ${tip}` +
      `C${xpk + w * 0.3} ${tip} ${x2} ${cy + dir * h * 0.95} ${x2} ${base}Z`,
  );
}

function silhouette(p) {
  return [bodyPath(p.body), tailPath(p.body, p.tail), finPath(p.body, p.dorsal, -1), finPath(p.body, p.ventral, 1)].filter(Boolean);
}

function extent(p) {
  const { nose, peduncle } = p.body;
  const t = p.tail;
  const left = t.style === 'none' ? peduncle : peduncle - t.length - (t.style === 'fan' ? t.bulge * 0.75 : 0);
  return { cx: (left + nose) / 2, cy: p.body.cy };
}

function stripeList(p) {
  const { nose: xn, peduncle: xp, cy, height: h } = p.body;
  const reach = h + Math.max(p.dorsal.height, p.ventral.height, p.tail.spread - h, 0) + 40;
  const s = p.stripes;
  return s.at.map((f, i) => {
    const x = xp + (xn - xp) * f;
    const bend = Array.isArray(s.bend) ? (s.bend[i] ?? 0) : s.bend;
    const w = Array.isArray(s.width) ? (s.width[i] ?? s.width.at(-1)) : s.width;
    return { d: fmt(`M${x} ${cy - reach}Q${x + 2 * bend} ${cy} ${x} ${cy + reach}`), w };
  });
}

function eyeOf(p) {
  const { nose: xn, peduncle: xp, cy, height: h } = p.body;
  return { x: r2(xp + (xn - xp) * p.eye.at), y: r2(cy + p.eye.dy * h), ...p.eye };
}

function viewTransform(p, v) {
  const e = extent(p);
  return `translate(${r2(256 + (v.dx ?? 0))} ${r2(256 + (v.dy ?? 0))}) scale(${v.scale}) rotate(${p.tilt}) translate(${r2(-e.cx)} ${r2(-e.cy)})`;
}

// ---------- drawing ----------
const paths = (list, attrs = '') => list.map((d) => `<path d="${d}"${attrs}/>`).join('');
const softAttrs = (p, color, extra = 0) =>
  p.soften + extra > 0 ? ` stroke="${color}" stroke-width="${p.soften + extra}" stroke-linejoin="round"` : '';

/** Colour fish (no plate) as an SVG fragment; ids prefixed with `id`. */
function fishColor(p, id) {
  const sil = silhouette(p);
  const stripes = stripeList(p);
  const eye = eyeOf(p);
  const c = p.colors;
  const cut = p.stripes.mode === 'cut';
  const defs = [];
  let out = '';

  // Mask that removes cut stripes / cut eye from the whole fish.
  const holes = [];
  if (cut) holes.push(...stripes.map((s) => `<path d="${s.d}" stroke-width="${s.w}"/>`));
  if (eye.style === 'cut') holes.push(`<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r}" fill="#000" stroke="none"/>`);
  const holeMask = holes.length ? ` mask="url(#${id}-holes)"` : '';
  if (holes.length)
    defs.push(
      `<mask id="${id}-holes" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/><g fill="none" stroke="#000">${holes.join('')}</g></mask>`,
    );

  out += `<g${holeMask}>`;
  if (p.outline > 0) out += `<g fill="${c.edge}"${softAttrs(p, c.edge, 2 * p.outline)}>${paths(sil)}</g>`;
  out += `<g fill="${c.body}"${softAttrs(p, c.body)}>${paths(sil)}</g>`;
  if (!cut && stripes.length) {
    defs.push(
      `<mask id="${id}-sil" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536"><g fill="#fff"${softAttrs(p, '#fff')}>${paths(sil)}</g></mask>`,
    );
    out += `<g mask="url(#${id}-sil)" fill="none">`;
    for (const s of stripes) {
      if (p.stripes.edge > 0) out += `<path d="${s.d}" stroke="${c.edge}" stroke-width="${s.w + 2 * p.stripes.edge}"/>`;
      out += `<path d="${s.d}" stroke="${c.stripe}" stroke-width="${s.w}"/>`;
    }
    out += `</g>`;
  }
  if (eye.style === 'dot') {
    if (eye.ring > 0) out += `<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r + eye.ring}" fill="${c.stripe}"/>`;
    out += `<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r}" fill="${c.eye}"/>`;
  }
  out += `</g>`;
  return { defs: defs.join(''), body: out };
}

/** Mask content (white = ink) for the one-colour fish: silhouette minus stripes and eye. */
function fishMonoInk(p, ink = '#fff', gap = '#000') {
  const sil = silhouette(p);
  const eye = eyeOf(p);
  const grow = p.outline > 0 ? 2 * p.outline : 0;
  let out = `<g fill="${ink}"${softAttrs(p, ink, grow)}>${paths(sil)}</g>`;
  out += `<g fill="none" stroke="${gap}">${stripeList(p)
    .map((s) => `<path d="${s.d}" stroke-width="${s.w}"/>`)
    .join('')}</g>`;
  if (eye.style !== 'none') out += `<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r}" fill="${gap}"/>`;
  return out;
}

function fillDef(fill, id) {
  if (typeof fill === 'string') return { def: '', ref: fill };
  const a = fill.angle ?? 45;
  const rad = (a * Math.PI) / 180;
  const x = r2(0.5 - Math.cos(rad) / 2);
  const y = r2(0.5 - Math.sin(rad) / 2);
  return {
    def: `<linearGradient id="${id}" x1="${x}" y1="${y}" x2="${r2(1 - x)}" y2="${r2(1 - y)}"><stop offset="0" stop-color="${fill.from}"/><stop offset="1" stop-color="${fill.to}"/></linearGradient>`,
    ref: `url(#${id})`,
  };
}

export function squirclePath(size = 512, n = 5) {
  const r = size / 2;
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([r + r * Math.sign(c) * Math.abs(c) ** (2 / n), r + r * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z';
}

function plateShape(plate, attrs) {
  switch (plate.shape) {
    case 'circle':
      return `<circle cx="256" cy="256" r="256"${attrs}/>`;
    case 'squircle':
      return `<path d="${squirclePath()}"${attrs}/>`;
    case 'rounded':
      return `<rect width="512" height="512" rx="${plate.radius}"${attrs}/>`;
    default:
      return '';
  }
}

const svg = (inner, label = 'Nemo') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${label}">${inner}</svg>\n`;

// ---------- outputs ----------
export function buildLayers(input = {}) {
  const p = merge(DEFAULTS, input);
  const hasPlate = p.plate.shape !== 'none';

  // Full app icon (plate + fish).
  const f = fishColor(p, 'nemo-f');
  const pf = fillDef(p.plate.fill, 'nemo-plate-fill');
  let fullDefs = f.defs + pf.def;
  let fullBody = '';
  if (hasPlate) {
    const stroke = p.plate.stroke;
    fullBody += plateShape(p.plate, ` fill="${pf.ref}"`);
    if (p.plate.clip) fullDefs += `<clipPath id="nemo-plate-clip">${plateShape(p.plate, '')}</clipPath>`;
    fullBody += `<g${p.plate.clip ? ' clip-path="url(#nemo-plate-clip)"' : ''}><g transform="${viewTransform(p, p.plate)}">${f.body}</g></g>`;
    if (stroke) {
      const w = stroke.width;
      const inset = { ...p.plate, radius: Math.max(0, p.plate.radius - w / 2) };
      fullBody += `<g transform="translate(${w / 2} ${w / 2}) scale(${r2((512 - w) / 512)})">${plateShape(inset, ` fill="none" stroke="${stroke.color}" stroke-width="${w}"`)}</g>`;
    }
  } else {
    fullBody += `<g transform="${viewTransform(p, p.plate)}">${f.body}</g>`;
  }
  const full = svg(`<defs>${fullDefs}</defs>${fullBody}`);

  // Transparent mark.
  const m = fishColor(p.mark.colors ? merge(p, { colors: p.mark.colors }) : p, 'nemo-m');
  const mark = svg(`<defs>${m.defs}</defs><g transform="${viewTransform(p, p.mark)}">${m.body}</g>`);

  // One-colour variant (tray, notification, themed icon source).
  let mono;
  if (p.mono.style === 'negative' && hasPlate) {
    mono = svg(
      `<defs><clipPath id="nemo-mono-clip">${plateShape(p.plate, '')}</clipPath><mask id="nemo-mono-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">` +
        `<g clip-path="url(#nemo-mono-clip)">${plateShape(p.plate, ' fill="#fff"')}<g transform="${viewTransform(p, p.plate)}">${fishMonoInk(p, '#000', '#fff')}</g></g>` +
        `</mask></defs><rect width="512" height="512" fill="#000" mask="url(#nemo-mono-cut)"/>`,
    );
  } else {
    mono = svg(
      `<defs><mask id="nemo-mono-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#000"/>` +
        `<g transform="${viewTransform(p, p.mono)}">${fishMonoInk(p)}</g></mask></defs><rect width="512" height="512" fill="#000" mask="url(#nemo-mono-cut)"/>`,
    );
  }

  // Android adaptive icon: 512 box = 108 dp canvas; safe zone = circle r 156.4 (66 dp).
  const a = fishColor(p, 'nemo-a');
  const adFg = svg(`<defs>${a.defs}</defs><g transform="${viewTransform(p, p.adaptive)}">${a.body}</g>`);
  const bgFill = fillDef(p.adaptive.bg ?? (hasPlate ? p.plate.fill : '#164D60'), 'nemo-ad-bg');
  const adBg = svg(`<defs>${bgFill.def}</defs><rect width="512" height="512" fill="${bgFill.ref}"/>`);
  const adMono = svg(
    `<defs><mask id="nemo-admono-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#000"/>` +
      `<g transform="${viewTransform(p, p.adaptive)}">${fishMonoInk(p)}</g></mask></defs><rect width="512" height="512" fill="#000" mask="url(#nemo-admono-cut)"/>`,
  );

  return { full, mark, mono, adFg, adBg, adMono, params: p };
}

// ---------- baked geometry (for the brand SVGs, Logo.tsx and the splash) ----------

/** Apply `fn([x, y]) -> [x, y]` to every coordinate pair of an absolute M/L/C/Q/Z path. */
export function transformPath(d, fn, digits = 1) {
  const out = [];
  let pair = [];
  for (const [, cmd, num] of d.matchAll(/([MLCQZ])|(-?\d*\.?\d+)/g)) {
    if (cmd) {
      out.push(cmd);
      continue;
    }
    pair.push(Number(num));
    if (pair.length === 2) {
      const [x, y] = fn(pair);
      out.push(`${Number(x.toFixed(digits))} ${Number(y.toFixed(digits))}`);
      pair = [];
    }
  }
  return out.join(' ').replace(/([MLCQZ]) /g, '$1').replace(/ ([MLCQZ])/g, '$1');
}

/** Points along an absolute M/L/C/Q/Z path (for bounding boxes and safe-zone checks). */
export function pathPoints(d, steps = 40) {
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
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
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

/**
 * The mark with its tilt already applied to the coordinates, centred at (256, 256) in a 512 box
 * (scale 1). Other views (tile, adaptive layer, maskable) only add a translate/scale wrapper, so
 * every brand SVG, Logo.tsx and the splash share identical `d` strings.
 */
export function markGeometry(input = {}) {
  const p = merge(DEFAULTS, input);
  if (p.stripes.mode !== 'cut') throw new Error('markGeometry expects cut stripes');
  const sil = silhouette(p);
  const stripes = stripeList(p);
  if (sil.length !== 2 || stripes.length !== 2) throw new Error('expected body + tail and two stripes');
  const e = extent(p);
  const a = (p.tilt * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const pt = ([x, y]) => {
    const dx = x - e.cx;
    const dy = y - e.cy;
    return [256 + dx * cos - dy * sin, 256 + dx * sin + dy * cos];
  };
  const eye = eyeOf(p);
  const [ex, ey] = pt([eye.x, eye.y]);
  const paths = sil.map((d) => transformPath(d, pt));
  const pts = paths.flatMap((d) => pathPoints(d));
  const pad = p.soften / 2;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const bbox = {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
    h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
  };
  /** Largest distance of the outline from (256, 256) after `scale` and an offset. */
  const radius = (scale = 1, dx = 0, dy = 0) =>
    Math.max(...pts.map(([x, y]) => Math.hypot((x - 256) * scale + dx, (y - 256) * scale + dy))) + (pad * scale);
  return {
    params: p,
    body: paths[0],
    tail: paths[1],
    cuts: stripes.map((s) => ({ d: transformPath(s.d, pt), w: s.w })),
    eye: { cx: Number(ex.toFixed(1)), cy: Number(ey.toFixed(1)), r: eye.r },
    soften: p.soften,
    bbox,
    radius,
  };
}
