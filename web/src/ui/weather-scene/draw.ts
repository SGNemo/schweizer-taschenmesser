/**
 * The weather scene as SVG markup: a port of `docs/design/weather-scenes/mockups/scene.js` (shape by shape, the
 * geometry block `G` unchanged). Pure: the same state and options give the same string; all randomness comes from the
 * seeded generator. Colours are never literal: every colour is a `--scene-*` token (`ui/tokens.css`) or a
 * `color-mix()` of tokens, so the themes live in CSS. "Ruhig" is drawn by the component (greys over the same shapes).
 * Not in this package: moon, sky events, the village landscape, the porthole and the moon glyph (packages 2–4).
 */
import {
  FALLING,
  inkOf,
  isDrizzle,
  isSnow,
  isThunder,
  skyOf,
  type SceneState,
  type SkyKey,
} from '@/core/weather/scene';

/* ============================== GEOMETRY (scene units, viewBox 0 0 1600 320) ============================== */
type Pt = readonly [number, number];
export const G = {
  W: 1600,
  H: 320,
  shelterX: 900,
  titleY: 60,
  arc: { x0: 1180, dx: 320, y0: 236, dy: 132 },
  sun: { r: 46, rHeat: 52, core: 0.62, halo: 2.6, haloOp: 0.35, low: 0.12 },
  peek: 0.35,
  ridges: {
    alp: [
      [0, 248],
      [480, 240],
      [640, 226],
      [712, 204],
      [760, 190],
      [800, 200],
      [860, 198],
      [915, 178],
      [960, 165],
      [995, 176],
      [1035, 158],
      [1062, 136],
      [1085, 128],
      [1110, 140],
      [1160, 170],
      [1230, 186],
      [1310, 190],
      [1380, 182],
      [1440, 160],
      [1468, 145],
      [1490, 140],
      [1512, 146],
      [1530, 142],
      [1552, 114],
      [1575, 100],
      [1592, 104],
      [1600, 108],
    ] as Pt[],
    far: [
      [0, 262],
      [300, 255],
      [600, 246],
      [800, 238],
      [960, 232],
      [1080, 224],
      [1150, 208],
      [1205, 178],
      [1240, 158],
      [1270, 150],
      [1300, 157],
      [1340, 180],
      [1390, 204],
      [1425, 200],
      [1455, 180],
      [1480, 170],
      [1505, 177],
      [1550, 198],
      [1600, 210],
    ] as Pt[],
    mid: [
      [0, 282],
      [220, 277],
      [440, 275],
      [640, 268],
      [860, 262],
      [1040, 251],
      [1180, 244],
      [1300, 236],
      [1420, 241],
      [1520, 231],
      [1600, 228],
    ] as Pt[],
    near: [
      [0, 304],
      [500, 301],
      [900, 296],
      [1050, 290],
      [1200, 277],
      [1320, 266],
      [1420, 262],
      [1510, 268],
      [1600, 276],
    ] as Pt[],
  },
  alpPeaks: [
    [760, 190],
    [960, 165],
    [1085, 128],
    [1490, 140],
    [1575, 100],
  ] as Pt[],
  farPeaks: [
    [1270, 150],
    [1480, 170],
  ] as Pt[],
  alpFade: [560, 820],
  flank: { max: 260, lean: 10, depth: 0.9, dark: 0.06 },
  capDepth: { high: 22, low: 15, far: 20, highY: 130 },
  lake: { x0: 930, x1: 1260, y0: 268, y1: 284, sky: 0.85 },
  bushes: [
    [1062, 7],
    [1236, 6],
    [1298, 8],
    [1452, 6],
    [1578, 9],
  ] as Pt[],
  crestBand: { h: 11, lift: 0.1 },
  conifers: {
    n: 34,
    from: 620,
    hMin: 14,
    hMax: 26,
    left: 6,
    leftFrom: 150,
    leftH: [8, 11],
    topMin: 250,
    w: 0.62,
  },
  crowns: [
    [1120, 14],
    [1176, 18],
    [1530, 24],
  ] as Pt[],
  grass: { n: 9, from: 1110, to: 1590 },
  stars: { n: 60, yMin: 8, yMax: 200, rMin: 0.8, rMax: 1.8, sparkles: 6, sparkR: 4, few: 0.35 },
  tpl: {
    s: {
      w: 120,
      h: 40,
      pill: [12, 24, 102, 16],
      c: [
        [24, 28, 12],
        [52, 20, 20],
        [86, 24, 15],
        [104, 30, 10],
      ],
    },
    m: {
      w: 190,
      h: 62,
      pill: [14, 36, 166, 26],
      c: [
        [34, 42, 20],
        [78, 30, 28],
        [124, 26, 26],
        [160, 42, 20],
      ],
    },
    l: {
      w: 280,
      h: 84,
      pill: [18, 50, 250, 34],
      c: [
        [44, 58, 26],
        [100, 42, 36],
        [164, 34, 34],
        [222, 52, 30],
        [250, 66, 18],
      ],
    },
  } as Record<'s' | 'm' | 'l', { w: number; h: number; pill: number[]; c: number[][] }>,
  shadeAt: 0.66,
  deck: { y: 104, arcs: [90, 150], depth: [9, 17] },
  stretch: 1.25,
  precip: {
    top: 60,
    mask: [900, 1050],
    leftOp: 0.2,
    rain: [45, 80, 120],
    snow: [60, 100, 150],
    drizzle: 50,
    hail: 40,
    slant: [10, 10, 28, 42],
    showers: [1150, 1500],
    len: 18,
    width: 2,
    op: 0.75,
    hailFrom: 1000,
    mass: [1130, 74, 1.35],
  },
  fog: [
    [1040, 560, 192, 18, 'far'],
    [640, 700, 226, 22, 'far'],
    [240, 620, 262, 24, 'near'],
    [940, 660, 252, 26, 'near'],
    [1260, 380, 234, 16, 'near'],
  ] as const,
  bolt: [
    [1296, 190],
    [1316, 190],
    [1305, 222],
    [1321, 222],
    [1288, 280],
    [1298, 236],
    [1283, 236],
  ] as Pt[],
  skew: [0, 6, 12, 20],
  shelter: { x1: 1300, op: 0.75, y0: 196, y1: 252 },
  motion: { rain: 2.4, rainHeavy: 1.6, snow: [10, 15], total: 12 },
  windStrokes: [
    [1150, 156, 190],
    [1238, 188, 210],
    [1330, 132, 170],
  ],
};

/** Offsets of each sky's gradient stops (the colours are `--scene-sky-<key>-<i>`); golden differs by theme. */
const SKY_OFFSETS: Record<SkyKey, readonly number[]> = {
  night: [0, 1],
  'night-full': [0, 1],
  'night-overcast': [0, 1],
  'night-rain': [0, 1],
  'night-snow': [0, 1],
  'night-fog': [0, 1],
  dawn: [0, 0.55, 1],
  dusk: [0, 0.55, 1],
  golden: [0, 0.7, 1],
  day: [0, 1],
  overcast: [0, 1],
  drizzle: [0, 1],
  rain: [0, 1],
  storm: [0, 1],
  snow: [0, 1],
  fog: [0, 1],
  heat: [0, 1],
};
export const skyOffsets = (key: SkyKey, theme: 'light' | 'dark'): readonly number[] =>
  key === 'golden' && theme === 'dark' ? [0, 0.6, 1] : SKY_OFFSETS[key];

/* ============================== utilities ============================== */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n: number): number => Math.round(n * 10) / 10;

/** A colour: a palette key becomes its token; an expression (`var(…)`, `color-mix(…)`, a keyword) stays. */
export function tok(h: string): string {
  return /^(var\(|color-mix\(|url\(|white$|black$|none$|currentColor$)/.test(h)
    ? h
    : `var(--scene-${h})`;
}
/** `a` blended toward `b` by `t` (0 = a, 1 = b), as CSS. */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return tok(a);
  if (t >= 1) return tok(b);
  return `color-mix(in srgb, ${tok(a)}, ${tok(b)} ${f(t * 100)}%)`;
}

type Attr = string | number | boolean | null | undefined;
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };
function attrs(o: Record<string, Attr>): string {
  let s = '';
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v == null || v === false) continue;
    // Values come from numbers, tables and token names only; escaped all the same, the markup goes to innerHTML.
    const val = typeof v === 'number' ? String(f(v)) : String(v).replace(/[&<"]/g, (c) => ESC[c]!);
    s += ` ${k}="${val}"`;
  }
  return s;
}
function el(tag: string, o: Record<string, Attr>, inner?: string): string {
  return `<${tag}${attrs(o)}${inner == null ? '/>' : `>${inner}</${tag}>`}`;
}
const circ = (x: number, y: number, r: number): string =>
  `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,1 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,1 ${f(-2 * r)},0`;
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${f(x + r)},${f(y)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(r)}v${f(h - 2 * r)}` +
    `a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(r)}h${f(2 * r - w)}a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(-r)}` +
    `v${f(2 * r - h)}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(-r)}z`
  );
}

interface Ridge {
  y: (x: number) => number;
  crest: string;
  fill: string;
}
/** Smooth ridge through key points: cubic Hermite with Catmull-Rom tangents, written as exact Bézier segments. */
function spline(keys: readonly Pt[]): Ridge {
  const n = keys.length;
  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = keys[Math.max(0, i - 1)]!;
    const b = keys[Math.min(n - 1, i + 1)]!;
    m.push((b[1] - a[1]) / (b[0] - a[0]));
  }
  const y = (x: number): number => {
    for (let i = 0; i < n - 1; i++)
      if (x <= keys[i + 1]![0] || i === n - 2) {
        const k0 = keys[i]!;
        const k1 = keys[i + 1]!;
        const h = k1[0] - k0[0];
        const t = Math.max(0, Math.min(1, (x - k0[0]) / h));
        const t2 = t * t;
        const t3 = t2 * t;
        return (
          (2 * t3 - 3 * t2 + 1) * k0[1] +
          (t3 - 2 * t2 + t) * h * m[i]! +
          (-2 * t3 + 3 * t2) * k1[1] +
          (t3 - t2) * h * m[i + 1]!
        );
      }
    return keys[n - 1]![1];
  };
  let d = `M${keys[0]![0]},${keys[0]![1]}`;
  for (let j = 0; j < n - 1; j++) {
    const k0 = keys[j]!;
    const k1 = keys[j + 1]!;
    const h = k1[0] - k0[0];
    d += `C${f(k0[0] + h / 3)},${f(k0[1] + (m[j]! * h) / 3)} ${f(k1[0] - h / 3)},${f(k1[1] - (m[j + 1]! * h) / 3)} ${k1[0]},${k1[1]}`;
  }
  return { y, crest: d, fill: `${d}V${G.H}H0Z` };
}

/* ============================== context ============================== */
type Stop = readonly [number, string, number?];
interface Ctx {
  s: SceneState;
  defs: string[];
  id: string;
  n: number;
  ext: number;
  quiet: number | null;
  haloK: number;
  skyMid: string;
  skyFill: string;
  bodyX: number | null;
  bodyP: Pt | null;
  br: number;
  clearBody: boolean;
  rm?: string;
}
const uid = (X: Ctx, p: string): string => `${X.id}${p}${X.n++}`;
function grad(
  X: Ctx,
  stops: readonly Stop[],
  o: Record<string, Attr> & { radial?: boolean },
): string {
  const id = uid(X, 'g');
  const { radial, ...rest } = o;
  X.defs.push(
    el(
      radial ? 'radialGradient' : 'linearGradient',
      { ...rest, id },
      stops
        .map((st) =>
          el('stop', { offset: st[0], 'stop-color': tok(st[1]), 'stop-opacity': st[2] ?? null }),
        )
        .join(''),
    ),
  );
  return `url(#${id})`;
}
function clip(X: Ctx, inner: string): string {
  const id = uid(X, 'c');
  X.defs.push(el('clipPath', { id }, inner));
  return `url(#${id})`;
}
function mask(X: Ctx, inner: string): string {
  const id = uid(X, 'm');
  X.defs.push(
    el(
      'mask',
      { id, maskUnits: 'userSpaceOnUse', x: 0, y: -300, width: G.W, height: G.H + 300 },
      inner,
    ),
  );
  return `url(#${id})`;
}

const PRECIP = FALLING;
const nightish = (s: SceneState): boolean =>
  s.phase === 'night' || s.phase === 'dawn' || s.phase === 'dusk';

function skyStops(key: SkyKey, theme: 'light' | 'dark'): Stop[] {
  return skyOffsets(key, theme).map((o, i) => [o, `var(--scene-sky-${key}-${i})`] as const);
}
/** The sky gradient's colour at a height (for atmospheric perspective). */
function skyAt(stops: readonly Stop[], y: number): string {
  const t = y / G.H;
  for (let i = 0; i < stops.length - 1; i++)
    if (t <= stops[i + 1]![0])
      return mix(
        stops[i]![1],
        stops[i + 1]![1],
        (t - stops[i]![0]) / (stops[i + 1]![0] - stops[i]![0]),
      );
  return stops[stops.length - 1]![1];
}

/* ============================== layers ============================== */
const layer = (name: string, inner: string, extra: Record<string, Attr> = {}): string =>
  inner ? `<g data-layer="${name}"${attrs(extra)}>${inner}</g>` : '';

function skyLayer(
  X: Ctx,
  sky: ReturnType<typeof skyOf>,
  stops: readonly Stop[],
  bp: Pt | null,
): string {
  const t0 = -X.ext;
  X.skyFill = grad(X, stops, { x1: 0, y1: t0, x2: 0, y2: G.H, gradientUnits: 'userSpaceOnUse' });
  let out = el('rect', { y: t0, width: G.W, height: G.H - t0, fill: X.skyFill });
  if (sky.glow) {
    const p = X.s.phase;
    const gx = p === 'dawn' ? 1210 : p === 'dusk' ? 1480 : bp ? bp[0] : 1300;
    const col = `glow-${p}`;
    const g = sky.glow.strength;
    const gl = grad(
      X,
      [
        [0, col, 0.75 * g],
        [0.5, col, 0.28 * g],
        [1, col, 0],
      ],
      {
        radial: true,
        cx: gx,
        cy: 250,
        r: 560,
        gradientUnits: 'userSpaceOnUse',
        gradientTransform: `translate(${gx} 250) scale(1 0.34) translate(${-gx} -250)`,
      },
    );
    out += el('rect', { width: G.W, height: G.H, fill: gl });
  }
  return out;
}

function starsLayer(X: Ctx): string {
  const s = X.s;
  const S = G.stars;
  const p = s.phase;
  if (!nightish(s)) return '';
  const total = S.n;
  let k = (1 - s.cloud / 100) * (p === 'dawn' || p === 'dusk' ? S.few : 1);
  if (s.cond === 'fog') k *= 0.3;
  const n = Math.round(total * k);
  const r = prng(s.seed * 13 + 1);
  const dots = ['', '', ''];
  let sp = '';
  for (let i = 0; i < total; i++) {
    const x = r() * G.W;
    const y = S.yMin + r() * (S.yMax - S.yMin);
    const rr = S.rMin + r() * (S.rMax - S.rMin);
    let b = r();
    if (i >= n) continue;
    const qx = X.quiet || 760;
    if (x < qx && y > (X.quiet ? -X.ext : 64) && (b < 0.85 || x < qx - 200)) continue; // hardly any stars behind the text
    if (x < qx) b = 0;
    if (i < S.sparkles && x > 700) {
      const q = S.sparkR;
      const w = q * 0.22;
      sp +=
        `M${f(x)},${f(y - q)}Q${f(x + w)},${f(y - w)} ${f(x + q)},${f(y)}Q${f(x + w)},${f(y + w)} ${f(x)},${f(y + q)}` +
        `Q${f(x - w)},${f(y + w)} ${f(x - q)},${f(y)}Q${f(x - w)},${f(y - w)} ${f(x)},${f(y - q)}Z`;
    } else dots[b < 0.4 ? 0 : b < 0.8 ? 1 : 2] += circ(x, y, rr);
  }
  const star = tok('star');
  let out = '';
  [0.45, 0.7, 0.95].forEach((o, i) => {
    if (dots[i]) out += el('path', { d: dots[i], fill: star, opacity: o });
  });
  if (sp) out += el('path', { d: sp, fill: star, opacity: 0.9 });
  return out;
}

function sunBody(X: Ctx, x: number, y: number, r: number, bottom: string): string {
  const s = X.s;
  const low = s.body.t < G.sun.low || s.body.t > 1 - G.sun.low;
  if (s.cond === 'fog')
    return el('circle', { cx: x, cy: y, r, fill: mix('sun-core', bottom, 0.35), opacity: 0.78 });
  const ring = tok(low ? 'sun-low' : 'sun');
  const core = low ? mix('sun-core', 'sun-low', 0.3) : tok('sun-core');
  const key = low ? 'sun-low' : 'sun';
  const hg = grad(
    X,
    [
      [0, key, 0.9],
      [0.4, key, 0.45],
      [1, key, 0],
    ],
    { radial: true },
  );
  let out = el('circle', {
    cx: x,
    cy: y,
    r: r * G.sun.halo * X.haloK,
    fill: hg,
    opacity: f(G.sun.haloOp * 100) / 100,
  });
  out += el('circle', { cx: x, cy: y, r, fill: ring });
  out += el('circle', { cx: x, cy: y, r: r * G.sun.core, fill: core });
  return out;
}

/* --- clouds --- */
function cloudPath(t: 's' | 'm' | 'l'): string {
  const T = G.tpl[t];
  const p = T.pill;
  let d = rrect(p[0]!, p[1]!, p[2]!, p[3]!, p[3]! / 2);
  for (const c of T.c) d += circ(c[0]!, c[1]!, c[2]!);
  return d;
}
interface Tone {
  b: string;
  sh: string;
  op: number;
}
function cloudTone(X: Ctx): Tone {
  const s = X.s;
  const c = s.cond;
  const dark = s.theme === 'dark';
  const p = s.phase;
  const i = s.intensity;
  const night = nightish(s);
  let b: string;
  let sh: string;
  if (night) {
    b = tok('cloud-night');
    sh = tok('cloud-night-shade');
    if (PRECIP.has(c) && !isSnow(c)) {
      b = mix(b, 'cloud-storm', 0.35);
      sh = mix(sh, 'cloud-storm-shade', 0.4);
    }
    if (p === 'dawn' || p === 'dusk') b = mix(b, `glow-${p}`, 0.18);
  } else if (isThunder(c)) {
    b = tok('cloud-storm');
    sh = tok('cloud-storm-shade');
  } else if (c === 'rain' || c === 'freezingRain') {
    const k = i === 3 ? 0.55 : i === 1 ? -0.3 : 0;
    b = k >= 0 ? mix('cloud-rain', 'cloud-storm', k) : mix('cloud-rain', 'cloud', -k);
    sh =
      k >= 0
        ? mix('cloud-rain-shade', 'cloud-storm-shade', k)
        : mix('cloud-rain-shade', 'cloud-shade', -k);
  } else if (isDrizzle(c) || c === 'showers') {
    b = mix('cloud-rain', 'cloud', 0.35);
    sh = mix('cloud-rain-shade', 'cloud-shade', 0.3);
  } else if (isSnow(c)) {
    b = mix('cloud-rain', 'cloud', 0.55);
    sh = mix('cloud-rain-shade', 'cloud-shade', 0.5);
  } else if (c === 'overcast') {
    b = mix('cloud-shade', 'cloud-rain', 0.25);
    sh = mix('cloud-shade', 'cloud-rain', 0.5);
  } else {
    b = tok('cloud');
    sh = tok('cloud-shade');
  }
  if (p === 'golden' && !PRECIP.has(c)) {
    b = mix(b, 'glow-golden', 0.22);
    sh = mix(sh, 'cloud-golden-shade', 0.3);
  }
  // clouds are opaque (a sun behind one must not show through): a pre-mix with the sky instead of transparency
  const sk = X.skyMid;
  if (dark && !night) {
    b = mix(b, sk, 0.5);
    sh = mix(sh, sk, 0.5);
  } else if (!night) {
    b = mix(b, sk, 0.08);
    sh = mix(sh, sk, 0.08);
  }
  return { b, sh, op: 1 };
}
function cloud(
  X: Ctx,
  tone: Tone,
  t: 's' | 'm' | 'l',
  x0: number,
  y0: number,
  sc0: number,
  cls = 'sc-drift',
): string {
  const s = X.s;
  const T = G.tpl[t];
  const d = cloudPath(t);
  let x = x0;
  let y = y0;
  let sc = sc0;
  if (X.quiet && x < X.quiet) {
    // small crops: clouds out of the text
    x = X.quiet + (x - G.shelterX) * 0.25;
    sc *= 0.7;
    y += 8;
  }
  const sx = sc * (s.wind >= 2 ? G.stretch : 1);
  if (X.clearBody && X.bodyP) {
    // little cover: no cloud touches the body's disc + 0.4·r (right of it, else below, else left)
    const B = X.bodyP;
    const rr = X.br * 1.4 + 4;
    const w = T.w * sx;
    const h = T.h * sc;
    const hit = (cx: number, cy: number): boolean => {
      const nx = Math.max(cx, Math.min(B[0], cx + w));
      const ny = Math.max(cy, Math.min(B[1], cy + h));
      return Math.hypot(nx - B[0], ny - B[1]) < rr;
    };
    if (hit(x, y)) {
      if (B[0] + rr + w <= G.W + 30 && !hit(B[0] + rr, y)) x = B[0] + rr;
      else if (!hit(x, B[1] + rr) && B[1] + rr + h < 200) y = B[1] + rr;
      else x = B[0] - rr - w;
    }
  }
  const fill = grad(
    X,
    [
      [0, tone.b],
      [G.shadeAt, tone.b],
      [G.shadeAt, tone.sh],
      [1, tone.sh],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  );
  let g = el(
    'g',
    {
      transform: `translate(${f(x)} ${f(y)}) scale(${f(sx * 100) / 100} ${sc})`,
      opacity: tone.op,
      'data-x': f(x),
    },
    el('path', { d, fill }),
  );
  if (s.wind >= 2) {
    const by = y + T.h * sc;
    g += el('path', {
      d: `M${f(x - 14)},${f(by - 8 * sc)}h${f(-70 * sc)}M${f(x - 34)},${f(by - 22 * sc)}h${f(-46 * sc)}`,
      stroke: tone.b,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      opacity: f(tone.op * 55) / 100,
    });
  }
  return s.motion ? el('g', { class: cls }, g) : g;
}
function deck(X: Ctx, tone: Tone, top: string): string {
  const s = X.s;
  const r = prng(s.seed * 7 + 3);
  const D = G.deck;
  let x = G.W;
  let d = `M0,${-X.ext}H${G.W}V${D.y}`;
  while (x > 0) {
    const w = D.arcs[0]! + r() * (D.arcs[1]! - D.arcs[0]!);
    const dep = D.depth[0]! + r() * (D.depth[1]! - D.depth[0]!);
    const nx = Math.max(0, x - w);
    const yy = D.y + (r() - 0.5) * 8;
    d += `Q${f((x + nx) / 2)},${f(yy + dep * 2)} ${f(nx)},${f(yy)}`;
    x = nx;
  }
  d += 'Z';
  const g = grad(
    X,
    [
      [0, mix(tone.b, top, 0.45)],
      [0.7, tone.b],
      [1, tone.sh],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  );
  // dark theme by day: a quieter deck (contrast)
  return el('path', {
    d,
    fill: g,
    opacity: s.theme === 'dark' && !nightish(s) ? 0.5 : 1,
    'data-part': 'deck',
  });
}
function cloudLayers(X: Ctx, bp: Pt | null, top: string): { far: string; main: string } {
  const s = X.s;
  const c = s.cond;
  const cov = s.cloud;
  const tone = cloudTone(X);
  let far = '';
  let main = '';
  if (c === 'fog') return { far: '', main: '' };
  const bx = bp ? bp[0] : 1340;
  const by = bp ? bp[1] : 124;
  const lowSun = s.body.t < G.sun.low || s.body.t > 1 - G.sun.low;
  X.clearBody = cov <= 35 || (cov <= 60 && lowSun);
  const isDeck = cov > 85;
  if (isDeck) main += deck(X, tone, top);
  if (isThunder(c)) {
    main += cloud(X, tone, 'l', 1080, 64, 1.5);
    main += el('ellipse', {
      cx: 1306,
      cy: 186,
      rx: 64,
      ry: 16,
      fill: grad(
        X,
        [
          [0, 'bolt', 0.55],
          [1, 'bolt', 0],
        ],
        { radial: true },
      ),
    });
  } else if (c === 'showers' || c === 'snowShowers') {
    main += cloud(X, tone, 'l', G.precip.showers[0]!, 82, 1.25);
    far += cloud(X, { ...tone, op: tone.op * 0.8 }, 's', 960, 92, 0.9);
  } else if (PRECIP.has(c)) {
    const M = G.precip.mass;
    main += cloud(X, tone, 'l', M[0]!, isDeck ? M[1]! + 8 : M[1]!, M[2]!);
  } else if (!isDeck) {
    if (cov > 60) {
      far += cloud(X, tone, 'm', 1040, 66, 0.9);
      main += cloud(X, tone, 'l', 930, 118, 1) + cloud(X, tone, 'l', bx - 124, by - 4, 1);
    } else if (cov > 35) {
      far += cloud(X, tone, 's', 1450, 66, 1);
      const low = !!bp && lowSun;
      const lx = low && bx < 1300 ? Math.min(bx + 70, 1310) : 960;
      main += cloud(X, tone, 'l', lx, low ? 70 : 92, low ? 0.8 : 1);
    } else if (cov > 10) {
      far +=
        cloud(X, tone, 's', 980, 74, 1) + cloud(X, tone, 's', bx > 1380 ? 1210 : 1450, 92, 0.95);
    }
  }
  return { far, main };
}

/* --- landscape --- */
interface Land {
  night: boolean;
  bottom: string;
  base: string;
  wet: boolean;
  near: string;
  mid: string;
  far: string;
  alp: string;
  crowns: string[];
  snowTone: string;
  snowShade: string;
  trees: string;
}
function landColours(X: Ctx, stops: readonly Stop[]): Land {
  const s = X.s;
  const night = nightish(s);
  const season = s.season;
  let base = night ? tok('land-night') : tok(`land-${season}`);
  if (!night && s.theme === 'dark') base = mix(base, 'land-night', 0.45);
  if (s.phase === 'dusk' || s.phase === 'dawn') base = mix(base, 'land-dusk', 0.25);
  const bottom = stops[stops.length - 1]![1];
  const wet = PRECIP.has(s.cond) && !isSnow(s.cond);
  let near = base;
  if (s.heat && !night) near = mix('dry-meadow', base, s.theme === 'dark' ? 0.45 : 0.1);
  if (wet) near = mix(near, 'black', 0.12);
  if (s.frost === 2) near = mix(near, 'rime', night ? 0.12 : 0.25);
  const snow = s.snowGround;
  const snowTone = night
    ? mix('snow', bottom, 0.6)
    : s.theme === 'dark'
      ? mix('snow', bottom, 0.62)
      : tok('snow');
  const crowns = [1, 2, 3].map((i) => tok(`land-${season}-${i}`));
  const o: Land = {
    night,
    bottom,
    base,
    wet,
    near: snow ? snowTone : near,
    mid: mix(snow ? snowTone : base, bottom, 0.3),
    far: night ? mix(mix(base, bottom, 0.62), 'haze-night', 0.2) : mix(base, bottom, 0.62),
    alp: night ? mix(mix(base, bottom, 0.78), 'haze-night', 0.22) : mix(base, bottom, 0.78),
    crowns: night
      ? [mix(base, 'black', 0.15), mix(base, 'black', 0.2), mix(base, 'black', 0.1)]
      : crowns.map((c) => (s.theme === 'dark' ? mix(c, 'land-night', 0.4) : c)),
    snowTone,
    snowShade: night
      ? mix('snow-shade', bottom, 0.55)
      : s.theme === 'dark'
        ? mix('snow-shade', bottom, 0.45)
        : tok('snow-shade'),
    trees: '',
  };
  o.trees = mix(snow ? mix(base, bottom, 0.3) : o.mid, 'black', night ? 0.25 : 0.22);
  return o;
}
/** Hard-contrast details fade out toward the text zone (x 700 → 1000). */
function rightMask(X: Ctx): string {
  if (!X.rm)
    X.rm = mask(
      X,
      el('rect', {
        width: G.W,
        height: G.H,
        fill: grad(
          X,
          [
            [0, 'white', 0],
            [1, 'white', 1],
          ],
          { x1: 700, x2: 1000, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' },
        ),
      }),
    );
  return X.rm;
}
const edges = (X: Ctx, crest: string, col: string, w: number, op: number): string =>
  el('path', {
    d: crest,
    fill: 'none',
    stroke: tok(col),
    'stroke-width': w,
    'stroke-linejoin': 'round',
    opacity: op,
    mask: rightMask(X),
  });
/** Rime and ice glaze on one crest. */
function ridgeTrims(X: Ctx, R: Ridge, LC: Land, which: 'far' | 'mid' | 'near'): string {
  const s = X.s;
  const w = which === 'far' ? 1.2 : 2;
  let out = '';
  if (s.frost > 0 && which !== 'far')
    out += edges(X, R.crest, 'rime', w * 0.75, LC.night ? 0.45 : 0.7);
  if ((s.cond === 'freezingDrizzle' || s.cond === 'freezingRain') && which !== 'far')
    out += edges(X, R.crest, 'ice', 1.6, 0.75);
  return out;
}
/** Clean scalloped caps: the cap line meets the crest exactly on both sides. */
function capPath(X: Ctx, R: Ridge, peaks: readonly Pt[], depth: (p: Pt) => number): string {
  let reg = '';
  const r = prng(X.s.seed * 5 + 11);
  for (const p of peaks) {
    const d = depth(p);
    if (!d || (X.quiet && p[0] < X.quiet)) continue; // no bright cap behind the text of a narrow crop
    let px = p[0];
    for (let q = p[0] - 15; q <= p[0] + 15; q++) if (R.y(q) < R.y(px)) px = q; // the spline's real summit
    const line = R.y(px) + d;
    let xl = px;
    let xr = px;
    while (R.y(xl - 1) < line && R.y(xl - 1) >= R.y(xl) - 0.01 && xl > p[0] - 220) xl--;
    while (R.y(xr + 1) < line && R.y(xr + 1) >= R.y(xr) - 0.01 && xr < p[0] + 220 && xr < G.W) xr++;
    if (R.y(xl - 1) < line || (xr < G.W && R.y(xr + 1) < line)) continue; // runs into the next summit: no cap
    if (xr - xl < 6) continue;
    const n = Math.max(2, Math.round((xr - xl) / 15));
    const w = (xr - xl) / n;
    reg += `M${xl},${f(line)}V-300H${xr}V${f(line)}`;
    for (let i = 0; i < n; i++)
      reg += `Q${f(xr - i * w - w / 2)},${f(line + (i % 2 ? 3 : 6 + r() * 4))} ${f(xr - (i + 1) * w)},${f(line)}`;
    reg += 'Z';
  }
  return reg;
}
/** Fill, one shaded flank per summit (away from the body), caps, trims. */
function mountain(
  X: Ctx,
  R: Ridge,
  LC: Land,
  peaks: readonly Pt[],
  col: string,
  which: 'alp' | 'far',
): string {
  const s = X.s;
  const op = s.cond === 'fog' ? 0.4 : 1;
  let out = el('path', { d: R.fill, fill: tok(col) });
  let fac = '';
  for (const p of peaks) {
    const side = X.bodyX != null && X.bodyX > p[0] ? -1 : 1;
    let xv = p[0];
    let d = `M${p[0]},${p[1]}`;
    while (
      Math.abs(xv - p[0]) < G.flank.max &&
      R.y(xv + side * 2) >= R.y(xv) - 0.01 &&
      xv > 0 &&
      xv < G.W
    )
      xv += side * 2;
    const D = (R.y(xv) - p[1]) * G.flank.depth + 12;
    let back = '';
    for (let i = 1; i <= 14; i++) {
      const x = p[0] + ((xv - p[0]) * i) / 14;
      d += `L${f(x)},${f(R.y(x))}`;
    }
    for (let j = 14; j >= 0; j--) {
      const u = j / 14;
      const x2 = p[0] + (xv - p[0]) * u - side * G.flank.lean * (1 - u);
      back += `L${f(x2)},${f(R.y(p[0] + (xv - p[0]) * u) + D * Math.pow(1 - u, 0.8))}`;
    }
    fac += `${d}${back}Z`;
  }
  if (fac)
    out += el('path', {
      d: fac,
      fill: mix(col, 'black', G.flank.dark),
      'clip-path': clip(X, el('path', { d: R.fill })),
    });
  const C = G.capDepth;
  const cold = s.season === 'winter' || s.frost > 0 || s.snowGround || isSnow(s.cond);
  const reg = !cold
    ? ''
    : capPath(X, R, peaks, (p) =>
        which === 'far' ? C.far * (p[1] < 160 ? 1 : 0.7) : p[1] <= C.highY ? C.high : C.low,
      );
  if (reg)
    out += el('path', {
      d: R.fill,
      fill: mix(
        LC.snowTone,
        LC.bottom,
        which === 'alp' ? 0.45 : LC.night ? 0.3 : s.theme === 'dark' ? 0.45 : 0.25,
      ),
      'clip-path': clip(X, el('path', { d: reg })),
    });
  out = el('g', { opacity: op }, out) + (which === 'far' ? ridgeTrims(X, R, LC, 'far') : '');
  if (which === 'alp')
    out = el(
      'g',
      {
        mask: mask(
          X,
          el('rect', {
            y: -300,
            width: G.W,
            height: 700,
            fill: grad(
              X,
              [
                [0, 'white', 0],
                [1, 'white', 1],
              ],
              { x1: G.alpFade[0], x2: G.alpFade[1], y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' },
            ),
          }),
        ),
      },
      out,
    );
  return out;
}
function lake(X: Ctx, LC: Land, bp: Pt | null): string {
  const s = X.s;
  const K = G.lake;
  const cx = (K.x0 + K.x1) / 2;
  const cy = (K.y0 + K.y1) / 2;
  const rx = (K.x1 - K.x0) / 2;
  const d =
    `M${K.x0},${cy}C${K.x0},${K.y0 - 1} ${f(cx - rx * 0.4)},${K.y0} ${cx},${K.y0}S${K.x1},${K.y0 + 2} ${K.x1},${cy}` +
    `S${f(cx + rx * 0.5)},${K.y1} ${cx},${K.y1}S${K.x0},${K.y1 - 2} ${K.x0},${cy}Z`;
  const frozen = s.frost === 2 || (s.season === 'winter' && s.frost > 0);
  let col = frozen
    ? mix('rime', LC.bottom, LC.night ? 0.6 : 0.35)
    : mix(LC.bottom, LC.mid, 1 - K.sky);
  if (s.heat && !frozen) col = mix(X.skyMid, LC.mid, 0.3); // heat: still water, not sand
  if (LC.wet) col = mix(col, 'black', 0.1);
  let out =
    el('path', { d, fill: mix(LC.mid, 'black', 0.12), transform: 'translate(0 2)' }) +
    el('path', { d, fill: col });
  if (frozen)
    out += el('path', { d, fill: 'none', stroke: tok('rime'), 'stroke-width': 1.5, opacity: 0.8 });
  const lowSun = s.body.kind === 'sun' && (s.body.t < 0.15 || s.body.t > 0.85);
  if (bp && !frozen && lowSun && bp[0] < 1330 && !(s.cloud > 85)) {
    // soft vertical light path
    const x = Math.min(bp[0], K.x1 - 30);
    let lp = '';
    for (const q of [
      [0, 26],
      [4, 20],
      [8, 15],
      [12, 9],
    ])
      lp += rrect(x - q[1]! / 2, K.y0 + 1.5 + q[0]!, q[1]!, 2.4, 1.2);
    out += el('path', {
      d: lp,
      fill: tok('sun-low'),
      opacity: 0.55,
      'clip-path': clip(X, el('path', { d })),
    });
  }
  return out;
}
function conifers(X: Ctx, R: Ridge, LC: Land): string {
  const s = X.s;
  const C = G.conifers;
  const r = prng(s.seed * 3 + 5);
  const k = Math.tan((G.skew[s.wind]! * Math.PI) / 180);
  let body = '';
  let caps = '';
  let trunks = '';
  const list: [number, number][] = [];
  for (let i = 0; i < C.left; i++)
    list.push([
      C.leftFrom + ((C.from - 60 - C.leftFrom) * (i + r() * 0.7)) / C.left,
      C.leftH[0]! + r() * (C.leftH[1]! - C.leftH[0]!),
    ]);
  for (let j = 0; j < C.n; j++) {
    const u = (j + 0.2 + r() * 0.6) / C.n;
    const x = C.from + (G.W - C.from + 10) * Math.pow(u, 0.62);
    list.push([x, C.hMin + (C.hMax - C.hMin) * (0.35 * u + 0.65 * r())]);
  }
  for (const t of list) {
    const x = t[0];
    const yb = R.y(x) + 2.5;
    let h = t[1];
    if (x < G.shelterX) h = Math.min(h, yb - C.topMin);
    if (h < 5) continue;
    const w = h * C.w;
    const P = (dx: number, dy: number): string => `${f(x + dx + k * dy)},${f(yb - dy)}`;
    const tier = (b: number, top: number, ww: number): string =>
      `M${P(-ww / 2, b)}L${P(-1.3, top - 1.6)}Q${P(0, top + 0.6)} ${P(1.3, top - 1.6)}L${P(ww / 2, b)}Q${P(0, b - 1.2)} ${P(-ww / 2, b)}Z`;
    body += tier(2, h * 0.66, w) + tier(h * 0.4, h, w * 0.74);
    trunks += `M${P(-1, -1)}L${P(-1, 3)}L${P(1, 3)}L${P(1, -1)}Z`;
    if (s.snowGround || s.frost > 0) {
      const ch = s.snowGround ? 0.34 : 0.16;
      const cw = w * 0.74 * ch;
      caps += `M${P(-cw / 2, h * (1 - ch))}L${P(-1.2, h - 1.6)}Q${P(0, h + 0.6)} ${P(1.2, h - 1.6)}L${P(cw / 2, h * (1 - ch))}Q${P(0, h * (1 - ch) + 1.5)} ${P(-cw / 2, h * (1 - ch))}Z`;
    }
  }
  let out =
    el('path', { d: trunks, fill: mix(LC.trees, 'black', 0.2) }) +
    el('path', { d: body, fill: LC.trees });
  if (caps)
    out += el('path', {
      d: caps,
      fill: s.snowGround ? LC.snowTone : tok('rime'),
      opacity: s.snowGround ? 0.95 : 0.8,
    });
  return s.motion && s.wind >= 2 ? el('g', { class: 'sc-sway' }, out) : out;
}
function crownTree(X: Ctx, LC: Land, R: Ridge, x: number, cr: number, idx: number): string {
  const s = X.s;
  const k = Math.tan((G.skew[s.wind]! * Math.PI) / 180);
  const yb = R.y(x) + 3;
  const th = cr * 0.95;
  const tw = Math.max(2.4, cr * 0.2);
  const bare = s.season === 'winter' || s.snowGround;
  const cy = yb - th - cr * 0.72;
  const cx = x + k * (th + cr * 0.72);
  const trunk = LC.night
    ? mix(LC.base, 'black', 0.35)
    : mix('trunk', LC.bottom, s.theme === 'dark' ? 0.35 : 0.1);
  let out = el('path', {
    d: `M${f(x - tw / 2)},${f(yb)}L${f(x - tw * 0.32 + k * th)},${f(yb - th - 2)}L${f(x + tw * 0.32 + k * th)},${f(yb - th - 2)}L${f(x + tw / 2)},${f(yb)}Z`,
    fill: trunk,
  });
  const col = LC.crowns[idx % 3]!;
  if (bare) {
    let br = '';
    const tx = x + k * th;
    const ty = yb - th;
    for (const b of [
      [-0.75, -0.9],
      [0.1, -1.25],
      [0.8, -0.85],
      [-0.35, -1.15],
    ])
      br += `M${f(tx)},${f(ty)}Q${f(tx + b[0]! * cr * 0.3 + k * cr * 0.5)},${f(ty - cr * 0.6)} ${f(tx + b[0]! * cr + k * cr)},${f(ty + b[1]! * cr)}`;
    out += el('circle', {
      cx,
      cy,
      r: cr * 0.86,
      fill: tok('land-winter-1'),
      opacity: LC.night ? 0.35 : 0.42,
    });
    out += el('path', {
      d: br,
      fill: 'none',
      stroke: trunk,
      'stroke-width': Math.max(1.4, cr * 0.09),
      'stroke-linecap': 'round',
    });
  } else {
    const d =
      circ(cx, cy, cr * 0.9) +
      circ(cx - cr * 0.42, cy + cr * 0.22, cr * 0.66) +
      circ(cx + cr * 0.44, cy + cr * 0.18, cr * 0.68) +
      circ(cx + cr * 0.04, cy - cr * 0.42, cr * 0.66);
    const dk = mix(col, 'black', 0.15);
    const fill = grad(
      X,
      [
        [0, col],
        [0.58, col],
        [0.58, dk],
        [1, dk],
      ],
      { x1: 0.15, y1: 0, x2: 0.85, y2: 1 },
    );
    out += el('path', { d, fill });
  }
  return s.motion && s.wind >= 2 ? el('g', { class: 'sc-sway' }, out) : out;
}
function nearRidge(X: Ctx, R: Ridge, LC: Land): string {
  const s = X.s;
  const fill = s.snowGround
    ? grad(
        X,
        [
          [0, LC.snowTone],
          [0.45, LC.snowTone],
          [1, LC.snowShade],
        ],
        { x1: 0, y1: 255, x2: 0, y2: 320, gradientUnits: 'userSpaceOnUse' },
      )
    : LC.near;
  let out = el('path', { d: R.fill, fill });
  const B = G.crestBand;
  let band = `M900,${f(R.y(900))}`;
  for (let bx = 920; bx <= G.W; bx += 20) band += `L${bx},${f(R.y(bx))}`;
  for (let bx2 = G.W; bx2 >= 900; bx2 -= 20)
    band += `L${bx2},${f(R.y(bx2) + B.h * (0.6 + 0.4 * Math.sin(bx2 / 37)))}`;
  out += el('path', {
    d: `${band}Z`,
    fill: mix(s.snowGround ? LC.snowTone : LC.near, LC.night ? 'crest-night' : 'white', B.lift),
    mask: rightMask(X),
  });
  out += ridgeTrims(X, R, LC, 'near');
  if (LC.wet) {
    let gl = '';
    for (const g of [
      [1240, 0.6],
      [1350, 0.9],
      [1470, 0.7],
    ]) {
      const y = R.y(g[0]!) + 14 + g[1]! * 8;
      gl += `M${g[0]},${f(y)}q${f(22 * g[1]!)},${f(-3 * g[1]!)} ${f(46 * g[1]!)},${f(-1)}`;
    }
    out += el('path', {
      d: gl,
      fill: 'none',
      stroke: mix(LC.near, 'white', 0.3),
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      opacity: 0.45,
    });
  }
  if (!s.snowGround) {
    const r = prng(s.seed * 17 + 2);
    const Gs = G.grass;
    let gt = '';
    for (let i = 0; i < Gs.n; i++) {
      const x = Gs.from + ((Gs.to - Gs.from) * (i + r())) / Gs.n;
      const y = R.y(x) + 1.5;
      const h = 4 + r() * 4;
      gt += `M${f(x)},${f(y)}l${f(-1.5)},${f(-h)}M${f(x + 3)},${f(y)}l${f(1)},${f(-h * 0.8)}`;
    }
    out += el('path', {
      d: gt,
      fill: 'none',
      stroke: mix(LC.near, s.heat ? 'grass-heat' : 'black', s.heat ? 0.4 : 0.22),
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
    });
  }
  let bu = '';
  for (const b of G.bushes) {
    const y = R.y(b[0]) + 2;
    bu += circ(b[0], y - b[1] * 0.55, b[1]) + circ(b[0] + b[1] * 0.85, y - b[1] * 0.3, b[1] * 0.7);
  }
  out += el('path', {
    d: bu,
    fill: s.snowGround ? mix(LC.trees, LC.snowTone, 0.3) : mix(LC.crowns[1]!, LC.near, 0.45),
  });
  G.crowns.forEach((c, i) => {
    out += crownTree(X, LC, R, c[0], s.season === 'winter' ? c[1] * 0.85 : c[1], i);
  });
  if (s.frost === 2) {
    const rs = prng(s.seed * 19 + 4);
    let sp = '';
    for (let j = 0; j < 8; j++) {
      const sx = 1080 + rs() * 500;
      const sy = R.y(sx) + 6 + rs() * 22;
      const q = 2.6;
      sp += `M${f(sx)},${f(sy - q)}L${f(sx + 0.6)},${f(sy - 0.6)}L${f(sx + q)},${f(sy)}L${f(sx + 0.6)},${f(sy + 0.6)}L${f(sx)},${f(sy + q)}L${f(sx - 0.6)},${f(sy + 0.6)}L${f(sx - q)},${f(sy)}L${f(sx - 0.6)},${f(sy - 0.6)}Z`;
    }
    out += el('path', { d: sp, fill: tok('rime'), opacity: 0.95 });
  }
  return out;
}
function fogBands(X: Ctx, which: 'far' | 'near'): string {
  if (X.s.cond !== 'fog') return '';
  const op = X.s.phase === 'night' ? 0.28 : X.s.theme === 'dark' ? 0.22 : 0.55;
  const g = grad(
    X,
    [
      [0, 'fog', 0],
      [0.25, 'fog', 1],
      [0.75, 'fog', 1],
      [1, 'fog', 0],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 0 },
  );
  let out = '';
  for (const b of G.fog)
    if (b[4] === which)
      out += el('rect', {
        x: b[0],
        y: b[2],
        width: b[1],
        height: b[3],
        rx: b[3] / 2,
        fill: g,
        opacity: op,
      });
  return X.s.motion && out ? el('g', { class: 'sc-fog' }, out) : out;
}

/* --- precipitation --- */
function precip(X: Ctx, bottom: string): string {
  const s = X.s;
  const c = s.cond;
  const P = G.precip;
  const i = s.intensity;
  const rainy =
    isDrizzle(c) || c === 'rain' || c === 'freezingRain' || c === 'showers' || isThunder(c);
  const snowy = isSnow(c);
  const hail = c === 'thunderHail';
  if (!rainy && !snowy) return '';
  const slant = P.slant[s.wind]!;
  const k = Math.tan((slant * Math.PI) / 180);
  const top = P.top;
  const Ht = G.H - top;
  const r = prng(s.seed * 29 + 7);
  const light = inkOf(s) === 'dark';
  const rainCol = mix(X.skyMid, 'white', light ? 0.45 : 0.55); // slightly lighter than the sky
  const region = (n: number, len: number, x0: number, x1: number): string => {
    let d = '';
    for (let j = 0; j < n; j++) {
      const x = x0 - k * Ht + r() * (x1 - x0 + k * Ht);
      const y = top + r() * Ht;
      const l = len * (0.75 + r() * 0.5);
      const seg = `l${f(k * l)},${f(l)}`;
      d += `M${f(x)},${f(y)}${seg}`;
    }
    return d;
  };
  const dots = (n: number, rMin: number, rMax: number, x0: number, x1: number): string => {
    let d = '';
    for (let j = 0; j < n; j++) {
      const x = x0 - k * Ht + r() * (x1 - x0 + k * Ht);
      const y = top + r() * Ht;
      const rr = rMin + r() * (rMax - rMin);
      d += circ(x, y, rr);
    }
    return d;
  };
  // Every motion ends after 5 s (a fractional loop: both tiles are drawn, so any stop is a whole picture). The tile
  // above is the same marks one tile higher (a `use` of them, not a second copy in the markup).
  const fall = (inner: string, dur: number): string => {
    if (!s.motion) return inner;
    const id = uid(X, 'p');
    return el(
      'g',
      {
        class: 'sc-fall',
        style: `--fx:${f(k * Ht)}px;--fy:${Ht}px;--dur:${dur}s;--n:${(5 / dur).toFixed(2)}`,
      },
      inner.replace('<path', `<path id="${id}"`) +
        el('use', { href: `#${id}`, transform: `translate(${f(-k * Ht)} ${-Ht})` }),
    );
  };
  const showers = c === 'showers' || c === 'snowShowers';
  const x0 = showers ? P.showers[0]! : 0;
  const x1 = showers ? P.showers[1]! : G.W;
  const rdur = i === 3 ? G.motion.rainHeavy : G.motion.rain;
  let out = '';
  if (rainy) {
    const drizzle = isDrizzle(c);
    let n = drizzle ? P.drizzle : P.rain[i - 1]!;
    if (showers) n = Math.round(n * 0.8);
    if (hail) n = Math.round(n * 0.5);
    out += fall(
      el('path', {
        d: region(n, drizzle ? 6 : P.len, x0, x1),
        stroke: rainCol,
        'stroke-width': drizzle ? 1.2 : i >= 2 ? P.width : 1.6,
        'stroke-linecap': 'round',
        opacity: P.op,
      }),
      drizzle ? rdur * 1.5 : rdur,
    );
  }
  if (snowy) {
    let sn = P.snow[i - 1]!;
    if (showers) sn = Math.round(sn * 0.6);
    const farCol = light ? mix('snow-shade', 'cloud-rain', 0.3) : mix('snow', bottom, 0.25);
    out += fall(
      el('path', { d: dots(Math.round(sn * 0.55), 1.6, 2.2, x0, x1), fill: farCol, opacity: 0.8 }),
      G.motion.snow[1]!,
    );
    out += fall(
      el('path', {
        d: dots(Math.round(sn * 0.45), 2.2, 3, x0, x1),
        fill: 'white',
        opacity: s.theme === 'dark' || !light ? 0.75 : 0.95,
      }),
      G.motion.snow[0]!,
    );
  }
  if (hail) {
    let hd = '';
    let he = '';
    for (let j = 0; j < P.hail; j++) {
      const hx = P.hailFrom + r() * (G.W - P.hailFrom);
      const hy = top + 10 + r() * (Ht - 10);
      const hr = 3.2;
      hd += circ(hx, hy, hr);
      he += `M${f(hx - hr)},${f(hy)}a${hr},${hr} 0 0 0 ${f(2 * hr)},0z`;
    }
    out += el('path', { d: hd, fill: 'white' }) + el('path', { d: he, fill: tok('hail-edge') });
  }
  // left of the shelter at 20 %, clipped below the title row (and under the shower cloud)
  const mk = mask(
    X,
    el('rect', {
      y: -X.ext,
      width: G.W,
      height: G.H + X.ext,
      fill: grad(
        X,
        [
          [0, 'white', snowy && !light ? P.leftOp * 0.4 : P.leftOp],
          [1, 'white', 1],
        ],
        {
          x1: X.quiet ? X.quiet - 150 : P.mask[0],
          x2: X.quiet || P.mask[1],
          y1: 0,
          y2: 0,
          gradientUnits: 'userSpaceOnUse',
        },
      ),
    }),
  );
  const cy = showers ? 178 : top;
  const clipD = showers
    ? `M${x0},${cy}H${x1}L${f(x1 + k * (G.H - cy))},${G.H}H${f(x0 + k * (G.H - cy))}Z`
    : `M0,${top}H${G.W}V${G.H}H0Z`;
  return el('g', { mask: mk }, el('g', { 'clip-path': clip(X, el('path', { d: clipD })) }, out));
}

/* --- bolt and wind --- */
function eventLayer(X: Ctx): string {
  if (!isThunder(X.s.cond)) return '';
  return el('path', {
    d: `M${G.bolt.map((p) => p.join(',')).join('L')}Z`,
    fill: tok('bolt'),
    'stroke-linejoin': 'round',
  });
}
function windLayer(X: Ctx, LC: Land): string {
  const s = X.s;
  if (s.wind < 2) return '';
  const op = LC.night ? 0.32 : inkOf(s) === 'dark' ? 0.75 : 0.45;
  let d = '';
  for (const w of G.windStrokes) {
    const [x, y, L] = w as [number, number, number];
    d += `M${x},${y}c${f(L * 0.3)},-10 ${f(L * 0.6)},8 ${f(L * 0.86)},0c${f(L * 0.09)},-3 ${f(L * 0.12)},-15 ${f(L * 0.04)},-17c-7,-2 -12,5 -7,10`;
  }
  let out = el('path', {
    d,
    fill: 'none',
    stroke: 'white',
    'stroke-width': 2.2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    opacity: op,
  });
  if (s.wind === 3)
    for (const l of [
      [1250, 176, -30, 0],
      [1410, 212, 20, 1],
      [1520, 150, 60, 2],
    ] as const)
      out += el('ellipse', {
        cx: l[0],
        cy: l[1],
        rx: 5,
        ry: 2.4,
        fill: LC.crowns[l[3]]!,
        transform: `rotate(${l[2]} ${l[0]} ${l[1]})`,
      });
  return out;
}

/* ============================== the scene ============================== */
export interface SceneOptions {
  /** End of the text zone in scene units (every crop narrower than 1600 units). */
  quietX?: number;
  /** Extra sky above y 0 (short or tall boxes). */
  extendTop?: number;
  /** The body at a fixed spot with a 0.75× halo (the phone head). */
  bodyAt?: Pt;
  /** Prefix of the ids in `<defs>` (unique per scene on a page). */
  idPrefix?: string;
}

export interface SceneSvg {
  viewBox: string;
  /** The scene's colours, each declared once as a custom property on the `<svg>` (`--c0` …) and used by name. */
  vars: Record<string, string>;
  /** `<defs>` and the layers, to be placed inside the component's own `<svg>`. */
  inner: string;
  ink: 'light' | 'dark';
  /** Where the body's centre and radius are (scene units), or none. */
  body: { x: number; y: number; r: number } | null;
}

/** Where the body sits on its arc ("partly behind the far ridge", never fully hidden). */
function bodyPos(s: SceneState, crest: (x: number) => number, r: number): Pt {
  const A = G.arc;
  const t = s.body.t;
  const x = A.x0 + A.dx * t;
  const y = Math.min(A.y0 - A.dy * Math.sin(Math.PI * t), crest(x) - G.peek * r);
  return [x, y];
}

export function sceneSvg(s: SceneState, opts: SceneOptions = {}): SceneSvg {
  const sky = skyOf(s);
  const stops = skyStops(sky.key, s.theme);
  const X: Ctx = {
    s,
    defs: [],
    id: opts.idPrefix ?? 'sc',
    n: 0,
    ext: opts.extendTop ?? 0,
    quiet: opts.quietX ?? null,
    haloK: opts.bodyAt ? 0.75 : 1,
    skyMid: skyAt(stops, 120),
    skyFill: '',
    bodyX: null,
    bodyP: null,
    br: 0,
    clearBody: false,
  };
  const top = stops[0]![1];
  const bottom = stops[stops.length - 1]![1];
  const far = spline(G.ridges.far);
  const mid = spline(G.ridges.mid);
  const near = spline(G.ridges.near);
  const alp = spline(G.ridges.alp);
  const crest = (x: number): number => Math.min(alp.y(x), far.y(x));
  const plain = s.level === 'plain';
  const deckOn = s.cloud > 85 && s.cond !== 'fog';
  const br = s.heat ? G.sun.rHeat : G.sun.r;
  const bp: Pt | null = s.body.kind === 'none' ? null : (opts.bodyAt ?? bodyPos(s, crest, br));
  X.bodyX = bp ? bp[0] : null;
  X.bodyP = bp;
  X.br = br;
  const L: string[] = [];
  L.push(layer('sky', skyLayer(X, sky, stops, bp)));
  L.push(layer('stars', plain ? '' : starsLayer(X)));
  let body = '';
  if (bp && !(deckOn && PRECIP.has(s.cond))) {
    if (deckOn)
      body = el('circle', {
        cx: bp[0],
        cy: Math.min(bp[1], 70),
        r: 90,
        fill: grad(
          X,
          [
            [0, 'white', 0.32],
            [1, 'white', 0],
          ],
          { radial: true },
        ),
      });
    else body = sunBody(X, bp[0], bp[1], br, bottom);
  }
  L.push(layer('body', body));
  if (!plain) {
    const LC = landColours(X, stops);
    const cl = cloudLayers(X, bp, top);
    L.push(layer('cloudsFar', cl.far));
    L.push(layer('ridgeAlp', mountain(X, alp, LC, G.alpPeaks, LC.alp, 'alp')));
    L.push(layer('ridgeFar', mountain(X, far, LC, G.farPeaks, LC.far, 'far')));
    L.push(layer('fog', fogBands(X, 'far')));
    let midOut =
      el('path', {
        d: mid.fill,
        fill: s.snowGround
          ? grad(
              X,
              [
                [0, LC.mid],
                [1, mix(LC.snowShade, bottom, 0.3)],
              ],
              { x1: 0, y1: 220, x2: 0, y2: 300, gradientUnits: 'userSpaceOnUse' },
            )
          : LC.mid,
      }) + ridgeTrims(X, mid, LC, 'mid');
    if (s.heat && !LC.night)
      midOut += el('rect', {
        y: 200,
        width: G.W,
        height: 50,
        fill: grad(
          X,
          [
            [0, 'heat-haze', 0],
            [0.5, 'heat-haze', 1],
            [1, 'heat-haze', 0],
          ],
          { x1: 0, y1: 0, x2: 0, y2: 1 },
        ),
        opacity: s.theme === 'dark' ? 0.16 : 0.5,
      });
    midOut += conifers(X, mid, LC);
    L.push(layer('ridgeMid', midOut));
    L.push(layer('fog', fogBands(X, 'near'), { 'data-part': 'front' }));
    L.push(layer('clouds', cl.main));
    L.push(layer('event', eventLayer(X)));
    L.push(layer('precip', precip(X, bottom)));
    L.push(layer('lake', lake(X, LC, bp)));
    L.push(layer('ridgeNear', nearRidge(X, near, LC)));
    L.push(layer('wind', windLayer(X, LC)));
    const S = G.shelter;
    const wash = grad(
      X,
      [
        [0, bottom, S.op],
        [0.72, bottom, S.op * 0.6],
        [1, bottom, 0],
      ],
      { x1: 0, x2: S.x1, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' },
    );
    const vm = mask(
      X,
      el('rect', {
        width: G.W,
        height: G.H,
        fill: grad(
          X,
          [
            [0, 'white', 0],
            [1, 'white', 1],
          ],
          { x1: 0, x2: 0, y1: S.y0, y2: S.y1, gradientUnits: 'userSpaceOnUse' },
        ),
      }),
    );
    L.push(
      layer(
        'shelter',
        el('rect', { y: S.y0, width: S.x1, height: G.H - S.y0, fill: wash, mask: vm }),
      ),
    );
  }
  // Each colour expression is declared once on the <svg> and used by name: the markup stays small (A11Y §4).
  const vars: Record<string, string> = {};
  const names = new Map<string, string>();
  const inner = `<defs>${X.defs.join('')}</defs>${L.join('')}`.replace(
    /(fill|stroke|stop-color)="((?:var|color-mix)\([^"]+)"/g,
    (_, prop: string, val: string) => {
      let name = names.get(val);
      if (!name) {
        name = `--c${names.size}`;
        names.set(val, name);
        vars[name] = val;
      }
      return `${prop}="var(${name})"`;
    },
  );
  return {
    viewBox: `0 ${-X.ext} ${G.W} ${G.H + X.ext}`,
    vars,
    inner,
    ink: inkOf(s),
    body: bp ? { x: bp[0], y: bp[1], r: br } : null,
  };
}
