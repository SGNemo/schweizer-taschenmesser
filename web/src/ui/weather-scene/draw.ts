/**
 * The weather scene v2 (docs/design/weather-scenes-2, direction B "Facetten") as SVG markup: a port of
 * `mockups/scene.js` + `events.js` + `motion.js`, shape by shape – the geometry block `G` keeps the mockup's names,
 * points and counts, the layers come in the mockup's order. Pure: the same state and options give the same string; all
 * randomness comes from the seeded generator.
 *
 * Colours are never literal: every colour is a `--scene-*` token (`ui/tokens.css`, the mockup's `palette.js`). The
 * mockup mixes hex values in JS; here each mix is a CSS `color-mix(in srgb, …)` (the same arithmetic) and each greying
 * a precomputed `--scene-grey-*` token (the same weights), declared once as a custom property on the `<svg>` (`--c0` …)
 * and used by name – so the themes live in CSS and the markup stays small (A11Y §4). "Ruhig" is drawn by the component.
 */
import {
  inkForSky,
  inkOf,
  isSnow,
  skyOf,
  type SceneState,
  type SkyKey,
} from '@/core/weather/scene';
type Pt = readonly [number, number];
type Tree = readonly [
  kind: 'spruce' | 'fir' | 'pine' | 'birch' | 'leaf' | 'bush',
  x: number,
  y: number,
  h: number,
];
interface Mountain {
  id: string;
  size: number;
  top: number;
  haze: number;
  sil: Pt[];
  arete: Pt[];
  ribs: (readonly [number, number, number])[];
  gullies: (readonly [number, number, number])[];
  fields: string[];
}

/* ============================== GEOMETRY (scene units, viewBox 0 0 1600 320) ============================== */
const W = 1600;
const H = 320;
export const G = {
  W,
  H,
  // the pale range far behind (whole width; under the text it is the only range)
  back: [
    [0, 206],
    [110, 194],
    [200, 201],
    [320, 182],
    [420, 195],
    [550, 174],
    [660, 191],
    [780, 166],
    [870, 183],
    [950, 168],
    [1040, 186],
    [1140, 170],
    [1240, 190],
    [1330, 174],
    [1440, 188],
    [1540, 170],
    [1600, 182],
  ] as Pt[],
  backPeaks: [
    [320, 182, 0.3],
    [550, 174, 0.4],
    [780, 166, 0.45],
    [1140, 170, 0.35],
    [1330, 174, 0.3],
  ] as (readonly [number, number, number])[],
  // the massif: six mountains, each its own shape, drawn back to front
  mountains: [
    {
      id: 'outlier',
      size: 0.5,
      top: 4,
      haze: 0.3,
      sil: [
        [836, 218],
        [872, 190],
        [900, 178],
        [924, 160],
        [948, 148],
        [962, 158],
        [984, 166],
        [1010, 192],
        [1030, 218],
      ],
      arete: [
        [948, 148],
        [944, 164],
        [951, 180],
        [942, 198],
        [947, 218],
      ],
      ribs: [
        [2, 884, 22],
        [6, 996, 20],
      ],
      gullies: [],
      fields: [],
    },
    {
      id: 'main',
      size: 1.25,
      top: 6,
      haze: 0.14,
      sil: [
        [1206, 218],
        [1240, 180],
        [1262, 162],
        [1286, 152],
        [1310, 114],
        [1330, 104],
        [1352, 76],
        [1366, 89],
        [1384, 93],
        [1404, 87],
        [1422, 112],
        [1452, 134],
        [1482, 170],
        [1516, 218],
      ],
      arete: [
        [1352, 76],
        [1347, 98],
        [1356, 116],
        [1344, 138],
        [1354, 160],
        [1340, 186],
        [1348, 218],
      ],
      ribs: [
        [2, 1250, 26],
        [4, 1292, 34],
        [8, 1392, 30],
        [10, 1440, 36],
      ],
      gullies: [
        [1338, 100, 16],
        [1370, 96, 20],
        [1408, 96, 14],
        [1322, 118, 18],
      ],
      fields: [
        'M1322,130l14,-6l10,8l-6,12l-14,4Z',
        'M1372,114l12,-4l8,10l-10,10Z',
        'M1300,152l12,-4l6,8l-12,8Z',
        'M1418,128l10,-2l6,10l-10,6Z',
      ],
    },
    {
      id: 'edge',
      size: 0.6,
      top: 2,
      haze: 0,
      sil: [
        [1516, 218],
        [1546, 160],
        [1574, 131],
        [1600, 146],
        [1600, 218],
      ],
      arete: [
        [1574, 131],
        [1570, 152],
        [1578, 172],
        [1568, 196],
        [1574, 218],
      ],
      ribs: [[1, 1548, 20]],
      gullies: [[1570, 144, 10]],
      fields: [],
    },
    {
      id: 'shoulder',
      size: 0.6,
      top: 4,
      haze: 0,
      sil: [
        [956, 218],
        [998, 178],
        [1022, 171],
        [1046, 142],
        [1074, 128],
        [1090, 139],
        [1114, 152],
        [1150, 192],
        [1176, 218],
      ],
      arete: [
        [1074, 128],
        [1070, 148],
        [1078, 166],
        [1068, 188],
        [1074, 218],
      ],
      ribs: [
        [2, 1012, 24],
        [6, 1122, 24],
      ],
      gullies: [
        [1066, 140, 10],
        [1084, 142, 9],
      ],
      fields: ['M1056,150l8,-4l6,8l-8,6Z'],
    },
    {
      id: 'west',
      size: 0.95,
      top: 4,
      haze: 0,
      sil: [
        [1038, 218],
        [1082, 162],
        [1104, 147],
        [1128, 113],
        [1150, 98],
        [1162, 109],
        [1178, 105],
        [1196, 127],
        [1224, 152],
        [1262, 192],
        [1292, 218],
      ],
      arete: [
        [1150, 98],
        [1146, 118],
        [1154, 134],
        [1143, 156],
        [1151, 176],
        [1140, 198],
        [1146, 218],
      ],
      ribs: [
        [2, 1088, 28],
        [6, 1188, 26],
        [8, 1238, 30],
      ],
      gullies: [
        [1136, 116, 14],
        [1168, 114, 12],
        [1122, 130, 12],
      ],
      fields: [
        'M1128,134l10,-6l8,10l-12,8Z',
        'M1170,130l8,-2l6,10l-10,4Z',
        'M1206,150l10,-3l5,8l-11,5Z',
      ],
    },
    {
      id: 'east',
      size: 0.8,
      top: 3,
      haze: 0,
      sil: [
        [1398, 218],
        [1440, 162],
        [1462, 147],
        [1490, 112],
        [1506, 123],
        [1524, 141],
        [1548, 151],
        [1580, 192],
        [1600, 208],
        [1600, 218],
      ],
      arete: [
        [1490, 112],
        [1486, 132],
        [1494, 150],
        [1484, 172],
        [1491, 194],
        [1485, 218],
      ],
      ribs: [
        [1, 1434, 24],
        [5, 1532, 28],
        [6, 1564, 24],
      ],
      gullies: [
        [1480, 128, 12],
        [1500, 128, 10],
      ],
      fields: ['M1472,138l8,-4l6,8l-8,8Z', 'M1508,144l10,-2l4,10l-10,4Z'],
    },
  ] as Mountain[],
  // round wooded hills in front of the massif, and the clearings on them
  hills: [
    [-20, 236],
    [130, 222],
    [250, 232],
    [390, 214],
    [520, 228],
    [650, 212],
    [790, 224],
    [900, 206],
    [990, 218],
    [1060, 196],
    [1120, 206],
    [1190, 188],
    [1262, 208],
    [1330, 198],
    [1400, 212],
    [1466, 184],
    [1530, 198],
    [1620, 180],
  ] as Pt[],
  clearings: [
    'M1040,212q16,-10 34,-6q-8,10 -34,6Z',
    'M1176,202q18,-9 40,-3q-14,9 -40,3Z',
    'M1450,200q20,-12 44,-8q-12,12 -44,8Z',
  ],
  f1: [
    [0, 244],
    [400, 238],
    [800, 241],
    [1100, 235],
    [1400, 231],
    [1600, 227],
  ] as Pt[],
  f2: [
    [0, 264],
    [400, 259],
    [800, 263],
    [985, 258],
  ] as Pt[],
  backShore: 'M930,270C1000,252 1100,249 1200,251C1290,252 1352,256 1410,264L1410,300L930,300Z',
  lake: 'M1002,281C1004,270 1052,263 1110,262C1150,261 1168,266 1196,264C1250,260 1318,264 1336,274C1348,282 1330,292 1290,297C1240,303 1180,300 1130,303C1070,306 1000,298 1002,281Z',
  lakeBox: [1002, 1340, 262, 304],
  ground: [
    [-20, 292],
    [160, 286],
    [330, 291],
    [520, 289],
    [700, 287],
    [860, 293],
    [990, 297],
    [1080, 306],
    [1160, 307],
    [1310, 304],
    [1344, 293],
    [1372, 280],
    [1410, 269],
    [1458, 265],
    [1560, 263],
    [1620, 258],
  ] as Pt[],
  way: 'M1424,267C1408,278 1436,288 1416,298C1402,306 1414,314 1408,320L1438,320C1442,312 1428,307 1440,297C1456,286 1424,279 1436,267Z',
  arc: { x0: 1010, x1: 1550, yLow: 150, rise: 80 },
  phoneBodyX: 1438,
  /** The phone's crop (CONCEPT §5): scale, the quiet edge. */
  phone: { k: 0.46, quietX: 1000 },
  cabin: [1404, 266, 1.15] as const,
  shed: [1350, 280, 0.62] as const,
  farHouses: [
    [1086, 256],
    [1110, 258],
    [1232, 254],
    [1250, 256],
  ] as Pt[],
  flag: [1340, 292] as Pt,
  jetty: [1318, 289] as Pt,
  boat: [1264, 288] as Pt,
  behind: [
    ['spruce', 1396, 264, 62],
    ['spruce', 1484, 260, 76],
    ['fir', 1502, 262, 40],
  ] as Tree[],
  trees: [
    ['spruce', 1562, 268, 118],
    ['spruce', 1592, 262, 84],
    ['pine', 1512, 268, 70],
    ['birch', 1546, 272, 46],
    ['bush', 1578, 274, 7],
    ['leaf', 1324, 298, 15],
    ['birch', 1372, 284, 40],
    ['spruce', 958, 296, 64],
    ['fir', 930, 293, 44],
    ['pine', 984, 298, 50],
    ['leaf', 890, 291, 13],
    ['bush', 1004, 300, 6],
    ['bush', 906, 296, 5],
    ['spruce', 872, 294, 38],
    ['birch', 1014, 303, 34],
    ['spruce', 1446, 300, 30],
    ['fir', 1470, 304, 22],
    ['leaf', 1610, 296, 14],
    ['fir', 1182, 258, 14],
    ['fir', 1194, 259, 11],
    ['fir', 1150, 257, 12],
  ] as Tree[],
  // four bolts, each its own figure, in the order the levels take them
  bolts: [
    {
      w: 4.4,
      op: 1,
      p: [
        [1218, 118],
        [1213, 131],
        [1220, 139],
        [1209, 152],
        [1214, 160],
        [1203, 171],
        [1207, 181],
        [1194, 196],
        [1198, 205],
        [1187, 219],
        [1190, 226],
        [1178, 240],
      ],
      forks: [
        [
          [1209, 152],
          [1222, 160],
          [1228, 172],
          [1240, 178],
          [1244, 190],
        ],
        [
          [1194, 196],
          [1182, 202],
          [1176, 212],
          [1166, 216],
        ],
      ],
    },
    {
      w: 3.2,
      op: 0.95,
      p: [
        [1470, 120],
        [1466, 134],
        [1473, 142],
        [1465, 156],
        [1469, 166],
        [1458, 176],
        [1460, 186],
        [1450, 198],
        [1452, 208],
      ],
      forks: [
        [
          [1469, 166],
          [1480, 174],
          [1478, 184],
          [1488, 192],
        ],
      ],
    },
    {
      w: 2.6,
      op: 0.9,
      p: [
        [1300, 122],
        [1318, 116],
        [1332, 124],
        [1352, 118],
        [1368, 127],
        [1390, 121],
        [1404, 131],
        [1426, 126],
      ],
      forks: [
        [
          [1368, 127],
          [1372, 140],
          [1366, 148],
          [1371, 160],
        ],
        [
          [1332, 124],
          [1328, 134],
          [1334, 141],
        ],
      ],
    },
    {
      w: 1.9,
      op: 0.55,
      p: [
        [1042, 116],
        [1038, 128],
        [1044, 136],
        [1035, 150],
        [1039, 158],
        [1030, 172],
        [1033, 180],
        [1026, 196],
      ],
      forks: [
        [
          [1035, 150],
          [1028, 156],
          [1026, 164],
        ],
      ],
    },
  ] as { w: number; op: number; p: Pt[]; forks: Pt[][] }[],
  /** The glow where the main bolt leaves the cloud (CONCEPT §7). */
  glow: [1216, 122, 52] as const,
  cloudShapes: [
    {
      l: [
        [-18, -8, 13],
        [0, -16, 17],
        [20, -9, 13],
      ],
      b: [-30, 32],
    },
    {
      l: [
        [-52, -7, 12],
        [-30, -15, 17],
        [-4, -21, 22],
        [24, -14, 18],
        [48, -8, 13],
      ],
      b: [-64, 60],
    },
    {
      l: [
        [-26, -9, 15],
        [-6, -24, 20],
        [10, -40, 16],
        [26, -20, 19],
        [44, -8, 12],
      ],
      b: [-40, 56],
    },
    {
      l: [
        [-40, -10, 15],
        [-18, -20, 19],
        [8, -10, 14],
        [30, -22, 20],
        [52, -9, 13],
      ],
      b: [-54, 64],
    },
    {
      l: [
        [-14, -5, 8],
        [2, -9, 10],
        [18, -5, 8],
      ],
      b: [-22, 26],
    },
  ] as { l: (readonly [number, number, number])[]; b: readonly [number, number] }[],
  cumulus: [
    [1430, 84, 1.05, 1],
    [1090, 100, 0.8, 0],
    [1300, 76, 1.1, 2],
    [1180, 66, 0.9, 4],
    [1520, 58, 0.9, 3],
    [1010, 62, 1, 1],
    [1390, 46, 1.1, 3],
    [1240, 50, 1, 0],
    [1565, 100, 0.75, 4],
  ] as (readonly [number, number, number, number])[],
  banks: [
    {
      at: [-150, 26],
      l: [
        [-50, 2, 20],
        [-20, -12, 26],
        [12, -8, 22],
        [40, 4, 18],
        [-78, 8, 14],
      ],
      base: [-18, 12, 76, 13],
    },
    {
      at: [-120, -30],
      l: [
        [-50, 0, 14],
        [-24, -8, 18],
        [4, -10, 20],
        [32, -4, 16],
        [56, 2, 12],
      ],
      base: [2, 6, 64, 9],
    },
    {
      at: [128, 20],
      l: [
        [-34, 0, 16],
        [-8, -10, 22],
        [20, -4, 18],
        [44, 6, 14],
      ],
      base: [6, 9, 56, 10],
    },
    {
      at: [108, -34],
      l: [
        [-40, 2, 14],
        [-14, -8, 20],
        [14, -6, 18],
        [40, 2, 14],
      ],
      base: [0, 7, 52, 9],
    },
    {
      at: [-62, 40],
      l: [
        [-70, 6, 20],
        [-44, -8, 26],
        [-14, -14, 24],
        [14, -4, 20],
        [40, 6, 16],
        [-96, 12, 14],
      ],
      base: [-30, 16, 86, 14],
    },
    {
      at: [38, 48],
      l: [
        [-36, -2, 18],
        [-10, -16, 24],
        [18, -10, 22],
        [44, 2, 18],
        [70, 8, 14],
      ],
      base: [16, 12, 70, 13],
    },
  ] as {
    at: Pt;
    l: (readonly [number, number, number])[];
    base: readonly [number, number, number, number];
  }[],
  lean: [0, 0.05, 0.24, 0.42],
  slant: [0, 0.14, 0.42, 0.8],
  rain: [0, 46, 96, 170],
  snow: [0, 60, 110, 170],
};

/** Sky events in the new picture (mockups/events.js `E`). */
export const E = {
  meteors: [
    [1258, 60, 104],
    [1478, 44, 70],
    [1064, 70, 62],
  ] as (readonly [number, number, number])[],
  milky: { cx: 1260, cy: 92, rx: 420, ry: 42, rot: -14, op: 0.13, n: 70 },
  rainbow: { cx: 1290, cy: 300, r: 190, w: 5, op: 0.72, fade: [196, 258] },
  aurora: {
    bands: [
      [985, 1290, 162, 1, 0],
      [1100, 1490, 146, 0.85, 1.7],
      [1310, 1630, 156, 0.7, 3.1],
      [1020, 1210, 170, 0.5, 4.4],
    ] as (readonly [number, number, number, number, number])[],
    few: 2,
    h: 128,
    top: 24,
    op: [0.2, 0.3],
    glow: [1260, 160, 520, 90],
    left: 960,
  },
  left: 900,
};

/** How a sky lights the land (palette.js `light`): mix toward `--scene-light-<sky>` by k after greying by `grey`. */
const LIGHT: Record<string, readonly [k: number, grey: number]> = {
  day: [0, 0],
  heat: [0.12, 0],
  golden: [0.16, 0],
  overcast: [0.2, 0.3],
  drizzle: [0.26, 0.32],
  rain: [0.4, 0.35],
  storm: [0.42, 0.25],
  snow: [0.22, 0.35],
  fog: [0.34, 0.45],
  dust: [0.3, 0.2],
  dawn: [0.56, 0.1],
  dusk: [0.56, 0.1],
  night: [0.76, 0.2],
  'night-full': [0.64, 0.15],
  'eclipse-sky': [0.6, 0.2],
};
/** Day skies in the dark theme: one more step toward night (`--scene-light-dark-theme`). */
const DARK_THEME_K = 0.42;
/** Skies with a twilight glow (palette.js `glow`). */
const GLOW: ReadonlySet<SkyKey> = new Set<SkyKey>(['dawn', 'dusk', 'golden', 'eclipse-sky']);

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
  dust: [0, 1],
  'eclipse-sky': [0, 1],
};
export const skyOffsets = (key: SkyKey, theme: 'light' | 'dark'): readonly number[] =>
  key === 'golden' && theme === 'dark' ? [0, 0.6, 1] : SKY_OFFSETS[key];

/* ============================== utilities (mockup scene.js) ============================== */
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
type Attr = string | number | null | undefined;
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };
function el(tag: string, o: Record<string, Attr>, inner?: string): string {
  let s = `<${tag}`;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v == null || v === '') continue;
    // Values are numbers, closed enums of the state and token names only – nothing a person typed; escaped all the same.
    const val =
      k === 'd' && typeof v === 'string'
        ? compactPath(v)
        : typeof v === 'number'
          ? String(Math.round(v * 100) / 100).replace(/^(-?)0\./, '$1.')
          : String(v).replace(/[&<"]/g, (c) => ESC[c]!);
    s += ` ${k}="${val}"`;
  }
  return s + (inner == null ? '/>' : `>${inner}</${tag}>`);
}
/** One decimal, without a leading zero (`.5`, `-.5`). */
const num = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  const t = String(Object.is(r, -0) ? 0 : r);
  return t.replace(/^(-?)0\./, '$1.');
};
/**
 * The right edge every shape is cut at (scene units). The picture's right edge is x 1600 – nothing right of it is ever
 * seen, but a shape that reaches past it still counts as wider than the window (`e2e/seed/layout-overflow`). Inside the
 * body's translated group it is `W − body x` (see `drawBody`).
 */
let LIM = 1600;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, q: 4, t: 2, c: 6, s: 4, a: 7, z: 0 };
/**
 * The same path, written short (A11Y §4 markup ceiling): every command relative, one decimal, no leading zeros. The
 * relative steps are taken between the rounded absolute points, so the shape does not drift.
 */
export function compactPath(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  let out = '';
  // `ux, uy`: where the pen is in the drawing; `x, y`: where the written path is (cut at the right edge `LIM`).
  let ux = 0;
  let uy = 0;
  let x = 0;
  let y = 0;
  let usx = 0;
  let usy = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  let cmd = '';
  let last = '';
  const put = (c: string, vals: number[]): void => {
    let body = '';
    for (const v of vals) {
      const t = num(v);
      body +=
        body && !t.startsWith('-') && !(t.startsWith('.') && /\.\d*$/.test(body)) ? ` ${t}` : t;
    }
    // the same command repeats implicitly (an `m` continues as `l`)
    if (c === last && c !== 'm') out += body.startsWith('-') ? body : ` ${body}`;
    else out += c + body;
    last = c === 'm' ? 'l' : c;
  };
  const r = (v: number): number => Math.round(v * 10) / 10;
  const cx = (v: number): number => Math.min(LIM, v);
  /** A straight piece to the drawing's (tx, ty): where it crosses the edge, the crossing comes first. */
  const lineTo = (tx: number, ty: number): void => {
    if (ux <= LIM !== tx <= LIM && tx !== ux) {
      const yi = r(uy + ((ty - uy) * (LIM - ux)) / (tx - ux));
      put('l', [r(LIM - x), r(yi - y)]);
      x = LIM;
      y = yi;
    }
    const nx = cx(tx);
    const dx = r(nx - x);
    const dy = r(ty - y);
    if (dy === 0) put('h', [dx]);
    else if (dx === 0) put('v', [dy]);
    else put('l', [dx, dy]);
    x = nx;
    y = ty;
    ux = tx;
    uy = ty;
  };
  while (i < tokens.length) {
    const tk = tokens[i]!;
    if (/[a-zA-Z]/.test(tk)) {
      cmd = tk;
      i++;
      if (cmd === 'z' || cmd === 'Z') {
        // the closing piece may cross the edge too
        if (ux <= LIM !== usx <= LIM && usx !== ux) {
          const yi = r(uy + ((usy - uy) * (LIM - ux)) / (usx - ux));
          put('l', [r(LIM - x), r(yi - y)]);
        }
        out += 'z';
        last = 'z';
        ux = usx;
        uy = usy;
        x = sx;
        y = sy;
        continue;
      }
    }
    const lower = cmd.toLowerCase();
    const n = ARGS[lower]!;
    const a = tokens.slice(i, i + n).map(Number);
    i += n;
    const rel = cmd === lower;
    const px = (k: number): number => r(rel ? ux + a[k]! : a[k]!);
    const py = (k: number): number => r(rel ? uy + a[k]! : a[k]!);
    if (lower === 'h') lineTo(px(0), uy);
    else if (lower === 'v') lineTo(ux, r(rel ? uy + a[0]! : a[0]!));
    else if (lower === 'l') lineTo(px(0), py(1));
    else if (lower === 'm') {
      const tx = px(0);
      const ty = py(1);
      put('m', [r(cx(tx) - x), r(ty - y)]);
      ux = usx = tx;
      uy = usy = ty;
      x = sx = cx(tx);
      y = sy = ty;
      cmd = rel ? 'l' : 'L';
    } else if (lower === 'a') {
      const tx = px(5);
      const ty = py(6);
      const nx = cx(tx);
      // the two flags need no separator (SVG path grammar): `a5 5 0 1110 0`
      put('a', [a[0]!, a[1]!, a[2]!]);
      const dy = num(ty - y);
      out += ` ${a[3] ? 1 : 0}${a[4] ? 1 : 0}${num(nx - x)}${dy.startsWith('-') ? '' : ' '}${dy}`;
      last = 'a+';
      x = nx;
      y = ty;
      ux = tx;
      uy = ty;
    } else {
      // curves: control and end points held at the edge (only ever the last units of a crown or a billow)
      const vals: number[] = [];
      for (let k = 0; k < n; k += 2) vals.push(r(cx(px(k)) - x), r(py(k + 1) - y));
      put(lower, vals);
      const tx = px(n - 2);
      const ty = py(n - 1);
      x = cx(tx);
      y = ty;
      ux = tx;
      uy = ty;
    }
  }
  return out;
}
const pts = (a: readonly Pt[], close?: boolean): string =>
  `M${a.map((p) => `${f(p[0])},${f(p[1])}`).join('L')}${close ? 'Z' : ''}`;
function yAt(line: readonly Pt[], x: number): number {
  for (let i = 1; i < line.length; i++)
    if (x <= line[i]![0]) {
      const a = line[i - 1]!;
      const b = line[i]!;
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
    }
  return line[line.length - 1]![1];
}
function jag(line: readonly Pt[], seed: number, amp: number, step: number): Pt[] {
  const r = prng(seed);
  const out: Pt[] = [line[0]!];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const d = b[0] - a[0];
    const n = Math.max(1, Math.round(d / step));
    for (let j = 1; j < n; j++) {
      const t = j / n + ((r() - 0.5) * 0.3) / n;
      out.push([a[0] + d * t, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 2 * amp]);
    }
    out.push(b);
  }
  return out;
}
/** An ellipse, cut at `lim` (the right edge): the part left of it, closed along the edge. */
function ellCut(cx: number, cy: number, rx: number, ry: number, lim: number): string {
  if (cx + rx <= lim)
    return `M${f(cx - rx)},${f(cy)}a${f(rx)},${f(ry)} 0 1,1 ${f(2 * rx)},0a${f(rx)},${f(ry)} 0 1,1 ${f(-2 * rx)},0Z`;
  if (cx - rx >= lim) return '';
  const dy = ry * Math.sqrt(1 - ((lim - cx) / rx) ** 2);
  // From the lower cut point round the left side to the upper one: clockwise on screen, the same winding as a whole
  // circle (`a … 0 1,1`), so cut and whole lobes in one path never cancel each other out (non-zero fill).
  return `M${f(lim)},${f(cy + dy)}A${f(rx)},${f(ry)} 0 ${cx < lim ? 1 : 0},1 ${f(lim)},${f(cy - dy)}Z`;
}
const circ = (x: number, y: number, r: number, lim = LIM): string => ellCut(x, y, r, r, lim);
const rrect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${f(x + r)},${f(y)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0 0,1 0,${f(h)}h${f(-(w - 2 * r))}a${f(r)},${f(r)} 0 0,1 0,${f(-h)}Z`;
const ell = (cx: number, cy: number, rx: number, ry: number, lim = LIM): string =>
  ellCut(cx, cy, rx, ry, lim);
function smooth(p: readonly Pt[], closeTo?: number): string {
  let d = `M${f(p[0]![0])},${f(p[0]![1])}`;
  for (let i = 1; i < p.length - 1; i++)
    d += `Q${f(p[i]![0])},${f(p[i]![1])} ${f((p[i]![0] + p[i + 1]![0]) / 2)},${f((p[i]![1] + p[i + 1]![1]) / 2)}`;
  const l = p[p.length - 1]!;
  d += `L${f(l[0])},${f(l[1])}`;
  return closeTo == null ? d : `${d}L${f(l[0])},${closeTo}L${f(p[0]![0])},${closeTo}Z`;
}
function ribbon(p: readonly Pt[], w0: number, w1: number): string {
  const L: Pt[] = [];
  const R: Pt[] = [];
  const n = p.length - 1;
  for (let i = 0; i <= n; i++) {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[Math.min(n, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const w = (w0 + ((w1 - w0) * i) / n) / 2;
    L.push([p[i]![0] - (dy / l) * w, p[i]![1] + (dx / l) * w]);
    R.unshift([p[i]![0] + (dy / l) * w, p[i]![1] - (dx / l) * w]);
  }
  return pts(L.concat(R), true);
}

/* ============================== the moon's shape (round 1, package 2) ============================== */
/** The lit shape with its lit side to the right (+x), centre 0,0; null for a new moon. */
export function litPath(r: number, illum: number): string | null {
  if (illum < 0.02) return null;
  if (illum > 0.98) return circ(0, 0, r);
  const rx = r * Math.abs(1 - 2 * illum);
  return `M0,${f(-r)}A${f(r)},${f(r)} 0 0 1 0,${f(r)}A${f(rx)},${f(r)} 0 0 ${illum < 0.5 ? 0 : 1} 0,${f(-r)}Z`;
}
/** The four flat maria: [cx, cy, rx, ry, rotation] as shares of the radius. */
export const MARIA: readonly (readonly [number, number, number, number, number])[] = [
  [-0.3, -0.3, 0.33, 0.25, -22],
  [0.22, -0.1, 0.21, 0.17, 12],
  [-0.1, 0.22, 0.2, 0.14, 0],
  [0.36, 0.38, 0.15, 0.11, 30],
];
/** SVG rotation that turns the lit-right shape so its lit side points `tilt` degrees left of up. */
export const tiltRotation = (tilt: number): number => -(tilt + 90) || 0;

/* ============================== colours as CSS ============================== */
/**
 * A colour: a palette key becomes its token; an expression (`var(…)`, a keyword) stays. Only ever called with literals
 * and expressions built in this file, never with outside data.
 */
export function tok(h: string): string {
  return /^(var\(|color-mix\(|url\(|white$|black$|none$|currentColor$)/.test(h)
    ? h
    : `var(--scene-${h})`;
}
/** The colour expressions of one scene, each declared once (`--c0` …) on the `<svg>`. */
class Book {
  vars: Record<string, string> = {};
  private memo = new Map<string, string>();
  ref(expr: string): string {
    let v = this.memo.get(expr);
    if (!v) {
      const name = `--c${this.memo.size}`;
      this.vars[name] = expr;
      v = `var(${name})`;
      this.memo.set(expr, v);
    }
    return v;
  }
  /** `a` blended toward `b` by `t` (0 = a, 1 = b): the mockup's `mix`. */
  mix(a: string, b: string, t: number): string {
    if (t <= 0) return tok(a);
    if (t >= 1) return tok(b);
    return this.ref(`color-mix(in srgb, ${tok(a)}, ${tok(b)} ${f(t * 100)}%)`);
  }
  /**
   * The mockup's `greyOf` (0.3 R + 0.59 G + 0.11 B): a precomputed `--scene-grey-<token>` – no relative colour
   * syntax, which older Safari and WebViews lack. Only palette tokens are greyed (`lit` is affine, so a mix is lit
   * part by part).
   */
  grey(c: string): string {
    if (!/^[a-z0-9-]+$/.test(c)) throw new Error(`grey of a token only: ${c}`);
    return tok(`grey-${c}`);
  }
}

/* ============================== the scene ============================== */
export interface SceneOptions {
  /** The right edge of the text column in scene units (desktop: measured; phone: `G.phone.quietX`). */
  quietX?: number;
  /** The part of the 1600 × 320 picture that is shown (`[x, y, w, h]`; the phone's crop reaches above y 0). */
  view?: readonly [number, number, number, number];
  /** The body at a fixed spot (the phone: `G.phoneBodyX`, its height from the arc). */
  bodyAt?: Pt;
  /** The phone's head: the body between the main summit and the third (`phoneBody`) unless `bodyAt` is given. */
  phone?: boolean;
  /** Prefix of the ids in `<defs>` (unique per scene on a page). */
  idPrefix?: string;
  /**
   * The porthole of this size (px): sky, the body in its mode, the main summit with its shaded face, one bank or
   * cloud and a few marks – nothing of the foreground, no sky event, never moving (`portholeSvg`).
   */
  porthole?: number;
}

export interface SceneSvg {
  viewBox: string;
  /** The scene's colours, each declared once as a custom property on the `<svg>` (`--c0` …) and used by name. */
  vars: Record<string, string>;
  /** `<defs>` and the layers, to be placed inside the component's own `<svg>`. */
  inner: string;
  ink: 'light' | 'dark';
  sky: SkyKey;
  /** Where the body's centre and radius are (scene units), or none. */
  body: { x: number; y: number; r: number } | null;
}

/** The body on its arc (`t` 0 … 1); the moon by its altitude (0° at the low end, ≥ 60° at the top). */
export function arcPoint(s: SceneState): Pt {
  const A = G.arc;
  const t = s.body.t;
  const x = A.x0 + (A.x1 - A.x0) * t;
  // One arc for sun and moon (mockup `G.arc`); a moon close to the horizon (< 12°) sinks toward the saddles, any
  // higher moon stays on the arc above the massif (CONCEPT §0 sentence 9: seen whenever it is above the horizon).
  const low =
    s.body.kind === 'moon' && s.body.alt != null ? Math.min(1, Math.max(0, s.body.alt / 12)) : 1;
  const up = Math.sin(Math.PI * t) * low;
  return [x, A.yLow - A.rise * up];
}
/** The phone's body: between the main summit and the third, y = 46 + 0.6 × (arc y − 70) (CONCEPT §5). */
export const phoneBody = (s: SceneState): Pt => [G.phoneBodyX, 46 + 0.6 * (arcPoint(s)[1] - 70)];

/** The phone's crop for a box of `w` × `h` px: the right `w / k` units, bottom-aligned (`Scene.phoneOpts`). */
export function phoneView(w: number, h: number): [number, number, number, number] {
  // a wide phone-layout box (up to 899 px) never zooms out past the whole width: no blank strip left of x 0
  const k = Math.max(G.phone.k, w / W);
  return [Math.round(W - w / k), Math.round(H - h / k), Math.round(w / k), Math.round(h / k)];
}

const WET_CONDS: ReadonlySet<string> = new Set([
  'drizzle',
  'freezingDrizzle',
  'rain',
  'freezingRain',
  'showers',
  'thunder',
  'thunderHail',
]);

export function sceneSvg(state: SceneState, o: SceneOptions = {}): SceneSvg {
  const pt = o.porthole ?? 0;
  // The small versions show no sky event (CONCEPT §6, open) and never move.
  const s: SceneState = pt ? { ...state, event: undefined, eventAmount: 0, motion: false } : state;
  const B = new Book();
  const key = skyOf(s).key;
  const th = s.theme === 'dark' ? 'dark' : 'light';
  const offs = skyOffsets(key, th);
  const stops: [number, string][] = offs.map((off, i) => [off, `sky-${key}-${i}`]);
  // a partial solar eclipse beyond 60 %: the sky one step dimmer (events.js, as an overlay rect)
  const idp = `${o.idPrefix ?? 'sc'}-`;
  let n = 0;
  const view = o.view ?? ([0, 0, W, H] as const);
  const top = Math.min(0, view[1]) - 4;
  const falling: '' | 'rain' | 'snow' = WET_CONDS.has(s.cond)
    ? 'rain'
    : isSnow(s.cond)
      ? 'snow'
      : '';
  const dark = !(s.phase === 'day' || s.phase === 'golden');
  const hasBody = s.body.kind !== 'none';
  const moonBody = s.body.kind === 'moon';
  const body: Pt = o.bodyAt ?? (o.phone ? phoneBody(s) : arcPoint(s));
  /** The body (and the bank beside it) larger in the porthole, so it still reads at 28 px. */
  const bodyK = pt ? PORTHOLE.bodyK : 1;
  const mode = s.mode;
  const dir = s.windTo === 'left' ? -1 : 1;
  const lean = G.lean[s.wind]! * dir;
  const plain = s.level === 'plain';
  const cover2 = s.snowCover >= 2;
  const frozen = s.frost >= 2 || (s.snowCover >= 2 && !s.wet);
  const q0 = o.quietX ?? 640;
  const q1 = q0 + 330;
  const motion = s.motion && !plain && !s.calm;
  const moonIllum = s.moon?.illum ?? 0;
  const moonSize = s.moon?.size ?? 1;
  const darkInk = inkForSky(key, 'light') === 'dark';

  /* ---- colours (mockup `colours`) ---- */
  const top0 = tok(stops[0]![1]);
  const bottom = tok(stops[stops.length - 1]![1]);
  const lightKey = /^night/.test(key)
    ? key === 'night-full'
      ? 'night-full'
      : 'night'
    : LIGHT[key]
      ? key
      : 'day';
  const [lk, lg] = LIGHT[lightKey]!;
  const dt = s.theme === 'dark' && darkInk;
  const lit = (c: string, k = 1): string => {
    const g = B.mix(B.mix(c, lg ? B.grey(c) : c, lg), `light-${lightKey}`, lk * k);
    return dt ? B.mix(g, 'light-dark-theme', DARK_THEME_K) : g;
  };
  const air = (c: string, a: number): string => B.mix(lit(c), bottom, a);
  const L = (n2: string): string => `land-${s.season}-${n2}`;
  const crowns = s.season === 'winter' ? [] : [1, 2, 3].map((i) => lit(L(`crown-${i}`)));
  const water = B.mix(B.mix(top0, bottom, 0.5), lit('water-deep'), 0.45);
  const wetSky = /storm|rain/.test(key);
  const C = {
    haze: bottom,
    far: air(L('rock'), 0.5),
    mid: air(L('mid'), 0.36),
    f1: air(L('f1'), 0.2),
    f2: air(L('f2'), 0.08),
    near: lit(L('near')),
    dark: lit(L('dark')),
    // lit is affine: the dry meadow is lit part by part (only tokens are greyed)
    meadow: s.heat ? B.mix(lit(L('meadow')), lit('dry-meadow'), 0.6) : lit(L('meadow')),
    snow: lit('snow', 0.6),
    snowShade: lit('snow-shade', 0.6),
    rime: lit('rime', 0.45),
    water,
    waterHi: B.mix(water, dark ? 'moon' : 'white', 0.55),
    ice: lit('ice', 0.6),
    iceHi: lit('ice-hi', 0.6),
    wall: lit('wall', 0.8),
    roof: lit('roof', 0.8),
    wood: lit('wood', 0.7),
    smoke: dark || wetSky ? B.mix('smoke-dark', bottom, 0.3) : lit('smoke', 0.5),
    flag: lit('flag', 0.6),
    crowns,
    lightsOn: dark || wetSky,
  };
  const deckName = /^night/.test(key)
    ? falling || s.fog
      ? 'night-wet'
      : 'night'
    : key === 'dawn' || key === 'dusk'
      ? 'twilight'
      : key === 'storm'
        ? 'storm'
        : key === 'snow'
          ? 'snow'
          : key === 'rain'
            ? 'wet'
            : 'day';
  const DT = [0, 1, 2, 3, 4].map((i) => tok(`deck-${deckName}-${i}`));

  /* ---- writers ---- */
  let out = '';
  let defs = '';
  const id = (p: string): string => `${idp}${p}${n++}`;
  const add = (tag: string, a: Record<string, Attr>, inner?: string): void => {
    out += el(tag, a, inner);
  };
  const path = (d: string, fill: string, extra: Record<string, Attr> = {}): void => {
    out += el('path', { d, fill: tok(fill), ...extra });
  };
  const line = (d: string, stroke: string, w: number, extra: Record<string, Attr> = {}): void => {
    out += el('path', {
      d,
      fill: 'none',
      stroke: tok(stroke),
      'stroke-width': w,
      ...extra,
    });
  };
  const open = (layer: string, extra = ''): void => {
    out += `<g data-layer="${layer}"${extra}>`;
  };
  const close = (): void => {
    out += '</g>';
  };
  const grad = (
    st: readonly (readonly [number, string, number?])[],
    a: Record<string, Attr>,
    radialG?: boolean,
  ): string => {
    const g = id('g');
    defs += el(
      radialG ? 'radialGradient' : 'linearGradient',
      { ...a, id: g },
      st
        .map((p) => el('stop', { offset: p[0], 'stop-color': tok(p[1]), 'stop-opacity': p[2] }))
        .join(''),
    );
    return `url(#${g})`;
  };
  const radial = (col: string, a0: number, a1: number, at?: number): string =>
    grad(
      [
        [at ?? 0, col, a0],
        [1, col, a1],
      ],
      { cx: 0.5, cy: 0.5, r: 0.5 },
      true,
    );
  type GlowStop = readonly [number, string, number];
  /**
   * A radial glow (circle or ellipse, optionally turned): a rect cut at the right edge (`LIM`), filled with the same
   * radial gradient in user space – the same pixels inside the picture, nothing reaching past its edge.
   */
  const glow = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    stops: readonly GlowStop[],
    extra: Record<string, Attr> = {},
    rot = 0,
  ): string => {
    const a = (rot * Math.PI) / 180;
    const hw = rot ? Math.hypot(rx * Math.cos(a), ry * Math.sin(a)) : rx;
    const hh = rot ? Math.hypot(rx * Math.sin(a), ry * Math.cos(a)) : ry;
    const x0 = cx - hw;
    const x1 = Math.min(cx + hw, LIM);
    if (x1 <= x0) return '';
    const shape =
      ry !== rx || rot
        ? `${rot ? `rotate(${rot} ${f(cx)} ${f(cy)}) ` : ''}translate(${f(cx)} ${f(cy)}) scale(1 ${Math.round((ry / rx) * 1000) / 1000}) translate(${f(-cx)} ${f(-cy)})`
        : null;
    const fill = grad(
      stops,
      { gradientUnits: 'userSpaceOnUse', cx: f(cx), cy: f(cy), r: f(rx), gradientTransform: shape },
      true,
    );
    return el('rect', {
      x: f(x0),
      y: f(cy - hh),
      width: f(x1 - x0),
      height: f(2 * hh),
      fill,
      ...extra,
    });
  };
  const lightRight = (x: number): boolean => x < body[0];
  const hk = (x: number): number => (x <= q0 ? 0.85 : x >= q1 ? 0 : (0.85 * (q1 - x)) / (q1 - q0));
  const hzc = new Map<string, string>();
  const hz = (fill: string): string => {
    let g = hzc.get(fill);
    if (!g) {
      const m = B.mix(fill, C.haze, 0.85);
      g = grad(
        [
          [0, m],
          [f(q0 / q1), m],
          [1, fill],
        ],
        { x1: 0, y1: 0, x2: q1, y2: 0, gradientUnits: 'userSpaceOnUse' },
      );
      hzc.set(fill, g);
    }
    return g;
  };
  const amount = (d: number): number =>
    s.event ? Math.max(0, Math.min(1, s.eventAmount ?? d)) : d;
  const wrapBody = (inner: string): string =>
    el(
      'g',
      {
        transform: `translate(${f(body[0])},${f(body[1])})`,
        'data-layer': 'body',
        'data-mode': mode,
        'data-event': s.event ?? null,
      },
      inner,
    );

  /* ---- sky ---- */
  open('sky');
  add('rect', {
    x: 0,
    y: top,
    width: W,
    height: H - top,
    fill: grad(
      stops.map((p) => [p[0], p[1]] as const),
      { x1: 0, y1: 0, x2: 0, y2: 250, gradientUnits: 'userSpaceOnUse' },
    ),
  });
  if (GLOW.has(key))
    out += glow(body[0], 236, 520, 120, [
      [0, `glow-${key}`, 0.55],
      [1, `glow-${key}`, 0],
    ]);
  if (s.heat && !plain)
    add('rect', {
      x: 0,
      y: 150,
      width: W,
      height: 110,
      fill: grad(
        [
          [0, 'heat-haze', 0],
          [1, 'heat-haze', 0.5],
        ],
        { x1: 0, y1: 0, x2: 0, y2: 1 },
      ),
    });
  close();

  /* ---- stars ---- */
  const starry = dark && key !== 'night-fog';
  const stars = (count: number, aroundBody?: boolean): void => {
    const q = prng(21);
    const d = ['', '', ''];
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      const r = 0.6 + q() * 0.9;
      if (aroundBody) {
        const a = q() * 6.28;
        const rr = 30 + q() * 60;
        x = body[0] + Math.cos(a) * rr * 1.5;
        y = body[1] - 4 + Math.sin(a) * rr * 0.6;
      } else {
        x = pt ? view[0] + q() * view[2] : q() * W;
        y = top + q() * (200 - top);
        if (Math.hypot(x - body[0], y - body[1]) < 44 * bodyK) continue;
      }
      d[i % 3] += circ(x, y, pt ? r * 3 : r);
    }
    [0.5, 0.75, 1].forEach((op, j) => {
      if (d[j]) path(d[j]!, 'star', { opacity: op });
    });
  };
  // "Schlicht" is sky and body only (CONCEPT §6): no stars either
  if (starry && s.cover < 4 && !falling && !plain) {
    open('stars');
    const moonLight = moonBody ? moonIllum : 0;
    stars(
      Math.round(
        (pt ? (s.phase === 'night' ? 12 : 5) : s.phase === 'night' ? 64 : 22) *
          (1 - s.cover * 0.22) *
          (1 - moonLight * 0.5),
      ),
    );
    close();
  }
  if (!plain) out += eventSky();

  /* ---- body ---- */
  let bodyR = 0;
  let bodyDrawn = false;
  // The body is drawn in its own translated group: there the right edge is `W − body x`.
  const drawBody = (pale: boolean): void => {
    const prev = LIM;
    LIM = (W - body[0]) / bodyK;
    try {
      drawBodyAt(pale);
    } finally {
      LIM = prev;
    }
  };
  const drawBodyAt = (pale: boolean): void => {
    if (!hasBody || bodyDrawn) return;
    bodyDrawn = true;
    const ev = eventBody(pale);
    if (ev != null) {
      out += ev;
      return;
    }
    let g = '';
    if (moonBody) {
      const R = 24 * moonSize;
      bodyR = R;
      const k = moonIllum;
      g += glow(0, 0, R * 2.7, R * 2.7, [
        [0, 'moon', pale ? 0.5 : 0.34],
        [1, 'moon', 0],
      ]);
      if (mode === 'veil')
        g += el('path', {
          d: circ(0, 0, R * 2.1),
          fill: 'none',
          stroke: tok('moon'),
          'stroke-width': 2.2,
          opacity: 0.3,
        });
      g += el('circle', {
        r: f(R),
        fill: tok('moon-dark'),
        opacity: k <= 0.05 ? 0.4 : pale ? 0.5 : 1,
      });
      const lp = litPath(R, k);
      if (lp)
        g += el(
          'g',
          {
            transform: `rotate(${tiltRotation(s.moon?.tilt ?? 0)})`,
            opacity: pale ? 0.72 : 1,
            'data-part': 'moon',
          },
          el('path', { d: lp, fill: tok('moon') }) +
            (k > 0.3
              ? el('path', {
                  d:
                    circ(R * 0.17, -R * 0.33, R * 0.23) +
                    circ(k > 0.6 ? -R * 0.12 : R * 0.5, R * 0.21, R * 0.17) +
                    circ(R * 0.38, R * 0.3, R * 0.12) +
                    (k > 0.6 ? circ(-R * 0.33, -R * 0.17, R * 0.11) : ''),
                  fill: tok('moon-mare'),
                })
              : ''),
        );
    } else {
      const low = s.phase === 'golden';
      const R = s.heat ? 30 : low ? 28 : 25;
      bodyR = R;
      const col = pale ? 'sun-pale' : low ? 'sun-low' : 'sun';
      const rays = pale ? 0 : s.heat ? 16 : s.sun >= 3 ? 12 : s.sun === 2 ? 8 : 0;
      g += glow(0, 0, R * 3.4, R * 3.4, [
        [0, 'sun-core', pale ? 0.5 : 0.6],
        [0.45, 'sun-core', 0.22],
        [1, 'sun-core', 0],
      ]);
      if (mode === 'veil')
        g += el('path', {
          d: circ(0, 0, R * 2.2),
          fill: 'none',
          stroke: 'white',
          'stroke-width': 2.4,
          opacity: 0.45,
        });
      if (rays) {
        let rd = '';
        for (let j = 0; j < rays; j++) {
          const an = (j / rays) * 6.283;
          const r0 = R + 7;
          const r1 = R + (s.sun === 2 && !s.heat ? 14 : j % 2 ? 17 : s.heat ? 30 : 24);
          const w = 0.085;
          rd += `M${f(Math.cos(an - w) * r0)},${f(Math.sin(an - w) * r0)}L${f(Math.cos(an) * r1)},${f(Math.sin(an) * r1)}L${f(Math.cos(an + w) * r0)},${f(Math.sin(an + w) * r0)}Z`;
        }
        g += el('path', { d: rd, fill: tok(col), opacity: 0.9, 'data-part': 'rays' });
      }
      g +=
        el('circle', { r: R, fill: tok(col), opacity: pale ? 0.8 : 1 }) +
        (pale ? '' : el('circle', { r: f(R * 0.62), fill: tok('sun-core') }));
    }
    out += el(
      'g',
      {
        transform: `translate(${f(body[0])},${f(body[1])})${bodyK !== 1 ? ` scale(${bodyK})` : ''}`,
        'data-layer': 'body',
        'data-mode': mode,
      },
      g,
    );
  };
  if (mode === 'clear' || mode === 'veil') drawBody(false);
  if (plain) {
    if (mode === 'schein' || mode === 'hole') drawBody(mode === 'schein');
    return finish();
  }

  /* ---- clouds ---- */
  const scallop = (
    x0: number,
    x1: number,
    y: number | ((x: number) => number),
    seed: number,
    depth: number,
    wMin: number,
    wMax: number,
    shear = 0,
  ): string => {
    const Y = typeof y === 'function' ? y : () => y;
    const q = prng(seed);
    let d = `L${x1},${f(Y(x1))}`;
    let x = x1;
    while (x > x0) {
      const w = wMin + q() * (wMax - wMin);
      const nx = Math.max(x0, x - w);
      const dp = depth * (0.5 + q());
      const mx = (x + nx) / 2;
      d += `Q${f(mx + shear)},${f(Y(mx) + dp * 2)} ${f(nx)},${f(Y(nx) + (q() - 0.5) * depth * 0.5)}`;
      x = nx;
    }
    return d;
  };
  const sheet = (
    y: number | ((x: number) => number),
    seed: number,
    depth: number,
    wMin: number,
    wMax: number,
    fill: string,
    shear?: number,
  ): void =>
    path(`M0,${top}L${W},${top}${scallop(0, W, y, seed, depth, wMin, wMax, shear)}Z`, fill, {
      'data-part': 'deck',
    });
  const sh = lean * 60;
  /** The porthole's one bank of a deck or a storm base: a sheet across its view. */
  const portholeSheet = (y: number, fill: string): void => {
    const x0 = view[0] - 10;
    const x1 = view[0] + view[2] + 10;
    path(`M${x0},${top}L${x1},${top}${scallop(x0, x1, y, 33, 8, 50, 100, sh)}Z`, fill, {
      'data-part': 'deck',
    });
  };
  const drift = motion ? ` class="sc-drift" style="--lee:${16 * dir}px"` : '';
  if (s.veil && s.cover < 4 && !pt) {
    open('cloudsFar', drift);
    const vq = prng(35);
    let vd = '';
    for (let vi = 0; vi < 7; vi++) {
      const vx = 860 + vq() * 640;
      const vy = 22 + vq() * 70;
      const vw = 120 + vq() * 160;
      vd += `M${f(vx)},${f(vy)}q${f(vw * 0.5)},${f(-8 - vq() * 6)} ${f(vw)},-2q${f(-vw * 0.5)},3 ${f(-vw)},2Z`;
    }
    path(vd, dark ? 'cloud-night' : 'white', { opacity: dark ? 0.5 : 0.6, 'data-part': 'veil' });
    close();
  }
  if (s.cover === 4 && s.thunder < 2) {
    const wetLow = falling ? 10 : 0;
    open('clouds');
    if (pt) portholeSheet(PORTHOLE.deckY + wetLow, DT[1]!);
    else {
      sheet(140 + wetLow, 31, 7, 70, 150, DT[0]!, sh);
      sheet(120 + wetLow, 32, 8, 60, 130, DT[1]!, sh);
      sheet(96 + wetLow, 33, 8, 70, 140, DT[2]!, sh);
      sheet(66 + wetLow, 34, 7, 80, 150, DT[3]!, sh);
    }
    close();
    if (mode === 'hole') {
      // The deck breaks into single banks around the body (CONCEPT §2); no outline of a hole anywhere.
      const hk2 = s.phase === 'night' ? 'night' : s.phase;
      const ho = skyOffsets(hk2, th);
      const hsCol = B.mix(`sky-${hk2}-0`, `sky-${hk2}-${ho.length - 1}`, 0.45);
      out += glow(
        body[0] - 6,
        body[1] - 4,
        196,
        92,
        [
          [0, hsCol, 1],
          [0.5, hsCol, 0.96],
          [0.78, hsCol, 0.55],
          [1, hsCol, 0],
        ],
        { 'data-layer': 'sky', 'data-part': 'opening' },
      );
      if (dark) {
        open('stars');
        stars(12, true);
        close();
      }
      out += glow(
        body[0],
        body[1],
        170,
        170,
        [
          [0.2, DT[4]!, 0.24],
          [1, DT[4]!, 0],
        ],
        { 'data-part': 'spill' },
      );
      drawBody(false);
      open('clouds', ` data-part="banks"${drift}`);
      // the porthole keeps the largest bank, below the body, at the body's size
      (pt ? [G.banks[PORTHOLE.bank]!] : G.banks).forEach((b, bi) => {
        const k = bodyK;
        const cx = body[0] + b.at[0] * k;
        const cy = body[1] + b.at[1] * k;
        const dd = Math.hypot(b.at[0], b.at[1]) || 1;
        const ux = -b.at[0] / dd;
        const uy = -b.at[1] / dd;
        let d = '';
        let inner = '';
        b.l.forEach((l0) => {
          const l = [l0[0] * k, l0[1] * k, l0[2] * k] as const;
          d += circ(cx + l[0], cy + l[1], l[2]);
          inner += circ(
            cx + l[0] + ux * l[2] * 0.16,
            cy + l[1] + uy * l[2] * 0.16 - l[2] * 0.08,
            l[2] * 0.8,
          );
        });
        d += ell(cx + b.base[0] * k, cy + b.base[1] * k, b.base[2] * k, b.base[3] * k);
        const tone = DT[1 + (bi % 3)]!;
        const near = Math.max(0.45, 1 - dd / 260);
        path(d, DT[4]!, {
          transform: `translate(${f(ux * 3.4)} ${f(uy * 3.4)})`,
          opacity: f(near),
          'data-part': 'rim',
        });
        path(d, tone, { 'data-bank': bi });
        path(inner, B.mix(tone, DT[4]!, 0.3 * near));
      });
      if (!pt)
        path(
          `M${f(body[0] - 96)},${f(body[1] - 44)}q30,-10 70,-5q16,2 26,-1q-12,9 -40,9q-30,1 -56,-3Z M${f(body[0] + 52)},${f(body[1] - 60)}q24,-7 52,-2q-22,7 -52,2Z`,
          B.mix(DT[2]!, DT[4]!, 0.3),
          { opacity: 0.8, 'data-part': 'shreds' },
        );
      close();
    }
    if (mode === 'schein') {
      out += glow(
        body[0],
        body[1],
        120,
        120,
        [
          [0, DT[4]!, 0.5],
          [1, DT[4]!, 0],
        ],
        { 'data-part': 'schein' },
      );
      drawBody(true);
    }
  }
  const cumulus = (x: number, y: number, sc: number, shape: number): string => {
    // drawn in its own translated, scaled (and sheared) group: the right edge in its units, less the shear's reach
    const prev = LIM;
    LIM = (W - x) / sc - (lean ? Math.abs(Math.tan((lean * 55 * Math.PI) / 180)) * 60 : 0);
    try {
      return cumulusAt(x, y, sc, shape);
    } finally {
      LIM = prev;
    }
  };
  const cumulusAt = (x: number, y: number, sc: number, shape: number): string => {
    const Sh = G.cloudShapes[shape]!;
    let d = '';
    let inner = '';
    Sh.l.forEach((l) => {
      d += circ(l[0], l[1], l[2]);
      if (l[1] > -22) inner += circ(l[0] + l[2] * 0.15, l[1] + l[2] * 0.4, l[2] * 0.55);
    });
    d += rrect(Sh.b[0], -12, Sh.b[1] - Sh.b[0], 14, 7);
    let lightC = dark ? 'cloud-night' : falling ? 'cloud-grey' : 'cloud';
    let shade = dark ? 'cloud-night-shade' : falling ? 'cloud-grey-shade' : 'cloud-shade';
    if (th === 'dark' && !dark) {
      lightC = B.mix(lightC, 'land-night', 0.66);
      shade = B.mix(shade, 'land-night', 0.72);
    }
    return el(
      'g',
      {
        transform: `translate(${f(x)} ${f(y)}) scale(${sc})${lean ? ` skewX(${f(-lean * 55)})` : ''}`,
      },
      el('path', { d, fill: tok(shade), transform: 'translate(0 4)' }) +
        el('path', { d, fill: tok(lightC) }) +
        el('path', { d: inner, fill: tok(shade), opacity: 0.45 }),
    );
  };
  if (s.cover >= 1 && s.cover <= 3 && s.thunder === 0 && pt) {
    // the porthole: one cloud, beside the body
    open('clouds');
    out += cumulus(...PORTHOLE.cloud);
    close();
  } else if (s.cover >= 1 && s.cover <= 3 && !pt) {
    open('clouds', drift);
    G.cumulus.slice(0, [0, 2, 4, 9][s.cover]).forEach((c) => {
      let x = c[0] + sh * 0.5;
      const y = c[1];
      const half = 62 * c[2];
      const gap = s.cover === 3 ? 34 : 58;
      if (hasBody && Math.abs(x - body[0]) < half + gap && Math.abs(y - 14 - body[1]) < 52)
        x = body[0] + (x < body[0] ? -1 : 1) * (half + gap);
      out += cumulus(x, y, c[2], c[3]);
    });
    if (s.cover === 3)
      out += el('g', { opacity: 0.55 }, cumulus(300, 46, 1.3, 1) + cumulus(660, 64, 1.1, 3));
    close();
  }
  if (s.thunder && pt) {
    open('clouds');
    portholeSheet(PORTHOLE.stormY, DT[0]!);
    close();
  } else if (s.thunder) {
    const wall = s.thunder >= 2;
    const baseY = (x: number): number =>
      x < 760 ? 86 : x > 1040 ? 124 : 86 + (38 * (x - 760)) / 280;
    open('clouds', wall ? '' : drift);
    if (wall) sheet(baseY, 53, 5, 44, 96, DT[0]!, sh * 0.5);
    let rim = '';
    let lobes = '';
    const lq = prng(52);
    const x0 = wall ? [820, 900, 1010, 1120] : [1130, 1150, 1180, 1200];
    const x1 = wall ? 1660 : 1470;
    for (let row = 0; row < 4; row++) {
      const y0 = [84, 44, -8, -70][row]!;
      for (let xx = x0[row]!; xx < x1 - (wall ? 0 : row * 16); xx += 58 + row * 14) {
        const r1 = (30 + lq() * 16) * (1 + row * 0.28);
        const cy = y0 + (lq() - 0.5) * 16;
        const cx3 = xx + sh * (0.3 + row * 0.25);
        lobes += circ(cx3, cy, r1);
        if (xx > x0[row]!) rim += circ(cx3 - r1 * 0.16, cy - r1 * 0.2, r1 * 0.96);
      }
    }
    if (wall) sheet((x) => baseY(x) - 26, 54, 4, 90, 170, DT[1]!, sh * 0.5);
    else
      path(
        `M1120,100Q1300,84 1480,100${scallop(1120, 1480, 122, 53, 4, 40, 80, sh * 0.5)}Z`,
        DT[0]!,
        { 'data-part': 'tower' },
      );
    path(rim, DT[4]!, { opacity: 0.75 });
    path(lobes, DT[1]!, { 'data-part': wall ? 'billows' : 'tower' });
    close();
  }
  // The body stays seen in every sky (CONCEPT §0 sentence 9): pale in a soft light on the cloud when the deck,
  // the storm base or dense fog hides its disc (the mockup drew only the light there – closed the smallest way).
  if (mode === 'schein' && !bodyDrawn) {
    const sr = s.thunder >= 2 ? 110 : 120;
    out += glow(
      body[0],
      s.thunder >= 2 ? Math.max(40, body[1] - 30) : body[1],
      sr,
      sr,
      [
        [0, DT[4]!, s.thunder >= 2 ? 0.42 : 0.5],
        [1, DT[4]!, 0],
      ],
      { 'data-part': 'schein' },
    );
    drawBody(true);
  }

  /* ---- the pale range far behind, then the massif: six mountains, each its own body ---- */
  const capOf = (crest: readonly Pt[], pk: Pt, depth: number): string => {
    const lim = pk[1] + depth;
    const Lx: number[] = [];
    const Rx: number[] = [];
    for (let x = pk[0]; x > pk[0] - 140; x -= 3) {
      if (yAt(crest, x) > lim) break;
      Lx.push(x);
    }
    for (let x = pk[0]; x < pk[0] + 140; x += 3) {
      if (yAt(crest, x) > lim) break;
      Rx.push(x);
    }
    const xl = Lx[Lx.length - 1]!;
    const xr = Rx[Rx.length - 1]!;
    const up = crest.filter((p) => p[0] > xl && p[0] < xr);
    let d = `M${f(xl)},${f(yAt(crest, xl))}${up.map((p) => `L${f(p[0])},${f(p[1])}`).join('')}L${f(xr)},${f(yAt(crest, xr))}`;
    const nz = Math.max(3, Math.round((xr - xl) / 11));
    const q2 = prng(Math.round(pk[0]));
    for (let i = 1; i < nz; i++) {
      const tt = i / nz;
      const zx = xr + (xl - xr) * tt;
      d += `L${f(zx)},${f(lim + (i % 2 ? depth * (0.25 + q2() * 0.45) : -depth * (0.2 + q2() * 0.3)))}`;
    }
    return `${d}Z`;
  };
  const cold = !!(s.snowCover || s.frost || s.season === 'winter' || falling === 'snow');
  const capK = cover2 ? 36 : cold ? 24 : s.season === 'summer' ? 10 : 15;
  const fogFar = [1, 0.35, 0][s.fog]!;
  const fogMid = [1, 0.65, 0.22][s.fog]!;
  const snowHaze = falling === 'snow' && s.intensity >= 3 ? 0.55 : 1;
  const farOp = Math.min(fogFar, snowHaze);
  const fogC = B.mix(C.haze, 'white', 0.55);
  let fogG: string | null = null;
  const fogBand = (y: number, h: number, op: number, x0?: number, w?: number): void => {
    // the band's gradient spans its whole length in user space; the rect stops at the picture's right edge
    const bx = x0 == null ? q0 - 80 : Math.max(x0, q0 - 80);
    const bw = w ?? W + 200 - q0;
    const g = grad(
      [
        [0, fogC, 0],
        [0.22, fogC, 1],
        [0.8, fogC, 1],
        [1, fogC, 0],
      ],
      { x1: f(bx), y1: 0, x2: f(bx + bw), y2: 0, gradientUnits: 'userSpaceOnUse' },
    );
    fogG ??= g;
    add('rect', { x: f(bx), y, width: f(Math.min(bw, W - bx)), height: h, fill: g, opacity: op });
  };
  if (farOp > 0) {
    open('ridgeAlp', farOp < 1 ? ` opacity="${farOp}"` : '');
    const bc = jag(G.back, 9, 2.5, 22);
    const bcol = B.mix(cover2 ? B.mix(C.far, C.snow, 0.5) : C.far, C.haze, 0.45);
    let bcaps = '';
    if (!pt)
      path(pts([[0, H] as Pt].concat(bc, [[W, H]]), true), hz(bcol), { 'data-part': 'back' });
    if (cold && !pt)
      G.backPeaks.forEach((pk) => {
        const d = pk[2] * capK * 0.8;
        if (d > 4) bcaps += capOf(bc, [pk[0], pk[1]], d);
      });
    if (bcaps) path(bcaps, B.mix(C.snow, C.haze, 0.55));
    const glowC = GLOW.has(key) ? `glow-${key}` : null;
    const rockGlow = glowC && s.cover < 4 ? 0.34 : 0;
    G.mountains.forEach((m, mi) => {
      // the porthole: the main summit alone
      if (pt && m.id !== 'main') return;
      const sil = jag(m.sil, 40 + mi, 1.6, 15);
      const S = m.sil[m.top]!;
      const shadeLeft = lightRight(S[0]);
      const it = sil.indexOf(S);
      const sd = shadeLeft ? -1 : 1;
      const q4 = prng(900 + mi);
      const hm = hk(S[0]);
      const col = B.mix(
        B.mix(
          B.mix(B.mix(C.far, C.haze, m.haze), C.snow, cover2 ? 0.55 : 0),
          glowC ?? 'black',
          rockGlow,
        ),
        C.haze,
        hm,
      );
      const snowC = B.mix(
        B.mix(B.mix(C.snow, C.haze, m.haze), glowC ?? 'black', rockGlow * 1.1),
        C.haze,
        hm,
      );
      out += `<g data-part="${m.id}">`;
      path(pts(sil, true), col);
      // the porthole has no hills in front: the mountain's foot reaches down to the rim
      if (pt) add('rect', { x: view[0], y: 216, width: view[2], height: H - 216, fill: col });
      const depth = m.size * capK;
      let cap = capOf(sil, S, depth);
      m.gullies.slice(0, cold ? 9 : 2).forEach((g) => {
        cap += `M${g[0]},${g[1]}l2.6,${g[2]}l-5.4,${f(-g[2] * 0.25)}Z`;
      });
      cap += m.fields.slice(0, cover2 ? 9 : cold ? 3 : 0).join('');
      path(cap, snowC, { 'data-part': 'caps' });
      let ribs = '';
      m.ribs.forEach((rb) => {
        const a = m.sil[rb[0]]!;
        const n2 = 4;
        let d = `M${a[0]},${a[1]}`;
        for (let k2 = 1; k2 <= n2; k2++) {
          const tt = k2 / n2;
          d += `L${f(a[0] + (rb[1] - a[0]) * tt + (k2 < n2 ? (k2 % 2 ? 1 : -1) * (2 + q4() * 3) : 0))},${f(a[1] + (218 - a[1]) * tt)}`;
        }
        ribs += `${d}L${f(rb[1] + sd * rb[2])},218Z`;
      });
      if (ribs)
        path(ribs, cover2 ? C.snowShade : C.dark, {
          opacity: f((cover2 ? 0.45 : 0.2) * (1 - hm)),
          'data-part': 'ribs',
        });
      const face = shadeLeft
        ? sil.slice(0, it + 1).concat(m.arete.slice(1))
        : sil.slice(it).concat(m.arete.slice(1).reverse());
      path(pts(face, true), cover2 ? C.snowShade : C.dark, {
        opacity: f((cover2 ? 0.7 : 0.36) * (1 - hm)),
        'data-part': 'shade',
      });
      if (s.wind === 3 && cover2 && m.size >= 0.8)
        path(
          `M${S[0]},${S[1]}q${f(dir * 22)},-9 ${f(dir * 52)},-4q${f(-dir * 20)},1 ${f(-dir * 44)},10Z`,
          C.snow,
          { opacity: 0.6, 'data-part': 'spindrift' },
        );
      out += '</g>';
    });
    close();
  }
  out += eventBehindLand();
  if (s.fog) {
    open('fog');
    fogBand(168, 30, 0.5);
    if (!pt) fogBand(196, 22, 0.42, 300, 1100);
    close();
  }
  if (pt) return portholeRest();

  /* ---- round wooded hills ---- */
  open('ridgeFar', fogMid < 1 ? ` opacity="${fogMid}"` : '');
  const hillCol = cover2 ? B.mix(C.mid, C.snow, 0.45) : C.mid;
  const hq = prng(14);
  let hd = '';
  path(smooth(G.hills, H), hz(hillCol));
  if (!cover2 && !s.fog)
    path(G.clearings.join(''), B.mix(C.meadow, C.haze, 0.4), {
      opacity: 0.8,
      'data-part': 'clearings',
    });
  for (let hx2 = 20; hx2 < W; hx2 += 9 + hq() * 16) {
    const hy = yAt(G.hills, hx2) + 6 + hq() * 10;
    const hh = 5 + hq() * 5;
    hd += `M${f(hx2 - hh * 0.38)},${f(hy)}L${f(hx2 + lean * hh)},${f(hy - hh)}L${f(hx2 + hh * 0.38)},${f(hy)}Z`;
  }
  path(hd, hz(B.mix(C.f1, hillCol, 0.35)), { 'data-part': 'wood' });
  close();

  /* ---- forest in staffels ---- */
  const skyline = (
    lineKeys: readonly Pt[],
    seed: number,
    sMin: number,
    sMax: number,
    hMin: number,
    hMax: number,
    fill: string,
    fogOp: number,
  ): void => {
    const q = prng(seed);
    let x = -10;
    let d = `M-10,${H}`;
    let tips = '';
    const end = lineKeys[lineKeys.length - 1]![0];
    while (x < end + 10) {
      const sp = sMin + q() * (sMax - sMin);
      const kind = q();
      const h = hMin + q() * (hMax - hMin) * (kind > 0.88 ? 1.5 : 1);
      const yb = yAt(lineKeys, Math.max(0, Math.min(end, x + sp / 2)));
      const tx = x + sp / 2 + lean * h * 1.1;
      if (kind > 0.7 && kind <= 0.88)
        d += `L${f(x)},${f(yb)}Q${f(tx - sp * 0.7)},${f(yb - h * 0.95)} ${f(tx)},${f(yb - h * 0.82)}Q${f(tx + sp * 0.7)},${f(yb - h * 0.95)} ${f(x + sp)},${f(yb)}`;
      else {
        d += `L${f(x)},${f(yb)}L${f(tx - sp * 0.16)},${f(yb - h * 0.52)}L${f(tx - sp * 0.3)},${f(yb - h * 0.5)}L${f(tx)},${f(yb - h)}L${f(tx + sp * 0.3)},${f(yb - h * 0.5)}L${f(tx + sp * 0.16)},${f(yb - h * 0.52)}`;
        tips += `M${f(tx - sp * 0.26)},${f(yb - h * 0.56)}L${f(tx)},${f(yb - h)}L${f(tx + sp * 0.26)},${f(yb - h * 0.56)}L${f(tx)},${f(yb - h * 0.7)}Z`;
      }
      x += sp;
    }
    d += `L${end + 10},${H}Z`;
    open('ridgeMid', `${fogOp < 1 ? ` opacity="${fogOp}"` : ''} data-part="skyline"`);
    path(d, hz(fill));
    if (s.snowCover) path(tips, C.snow, { opacity: cover2 ? 0.85 : 0.5, 'data-part': 'caps' });
    else if (s.frost) path(tips, C.rime, { opacity: 0.22, 'data-part': 'caps' });
    close();
  };
  interface Acc {
    full: string;
    shade: string;
    snow: string;
    trunk: string;
    crown: [string, string, string];
    crownShade: string;
    bare: string;
    birch: string;
    marks: string;
  }
  const newAcc = (): Acc => ({
    full: '',
    shade: '',
    snow: '',
    trunk: '',
    crown: ['', '', ''],
    crownShade: '',
    bare: '',
    birch: '',
    marks: '',
  });
  const shear =
    (_x: number, yb: number, h: number) =>
    (px: number, py: number): string => {
      const dy = yb - py;
      return `${f(px + lean * dy * (0.45 + (0.9 * dy) / h))},${f(py)}`;
    };
  const spruce = (
    x: number,
    yb: number,
    h: number,
    acc: Acc,
    seed: number,
    wide?: boolean,
  ): void => {
    const q = prng(seed);
    const tn = wide ? 3 : Math.max(3, Math.round(h / 21));
    const w = h * (wide ? 0.46 : 0.36);
    const P = shear(x, yb, h);
    const side = lightRight(x) ? -1 : 1;
    acc.trunk += `M${P(x - h * 0.03, yb)}L${P(x - h * 0.03, yb - h * 0.2)}L${P(x + h * 0.03, yb - h * 0.2)}L${P(x + h * 0.03, yb)}Z`;
    for (let i = 0; i < tn; i++) {
      const b = yb - h * (0.1 + (0.76 * i) / tn);
      const a = i === tn - 1 ? yb - h : b - h * (1.3 / tn);
      const k = 1 - (0.68 * i) / tn;
      const wl = w * k * (0.88 + q() * 0.24);
      const wr = w * k * (0.88 + q() * 0.24);
      const dr = h * 0.022;
      acc.full += `M${P(x - wl, b + dr)}L${P(x, a)}L${P(x + wr, b + dr)}L${P(x + wr * 0.62, b - dr * 0.7)}L${P(x + wr * 0.33, b + dr * 0.8)}L${P(x, b - dr * 0.5)}L${P(x - wl * 0.33, b + dr * 0.8)}L${P(x - wl * 0.62, b - dr * 0.7)}Z`;
      const ws = side > 0 ? wr : wl;
      acc.shade += `M${P(x, a)}L${P(x + side * ws, b + dr)}L${P(x + side * ws * 0.62, b - dr * 0.7)}L${P(x + side * ws * 0.33, b + dr * 0.8)}L${P(x, b - dr * 0.5)}Z`;
      acc.snow += `M${P(x - wl * 0.6, b - (b - a) * 0.36)}L${P(x, a)}L${P(x + wr * 0.6, b - (b - a) * 0.36)}L${P(x + wr * 0.2, b - (b - a) * 0.5)}L${P(x - wl * 0.25, b - (b - a) * 0.3)}Z`;
    }
  };
  const pine = (x: number, yb: number, h: number, acc: Acc): void => {
    const P = shear(x, yb, h);
    const k = lean * h;
    const side = lightRight(x) ? -1 : 1;
    acc.trunk +=
      `M${P(x - h * 0.028, yb)}L${P(x - h * 0.012, yb - h * 0.9)}L${P(x + h * 0.016, yb - h * 0.9)}L${P(x + h * 0.028, yb)}Z` +
      `M${P(x, yb - h * 0.52)}L${P(x + h * 0.17, yb - h * 0.62)}L${P(x + h * 0.17, yb - h * 0.6)}L${P(x, yb - h * 0.48)}Z`;
    [
      [-0.1, 0.8, 0.2, 0.08],
      [0.1, 0.9, 0.22, 0.085],
      [-0.02, 1.0, 0.15, 0.07],
      [0.18, 0.64, 0.11, 0.045],
    ].forEach((c) => {
      const cx = x + c[0]! * h + k * c[1]! * 1.1;
      const cy = yb - c[1]! * h;
      acc.full += ell(cx, cy, c[2]! * h, c[3]! * h);
      acc.shade += ell(
        cx + side * c[2]! * h * 0.3,
        cy + c[3]! * h * 0.42,
        c[2]! * h * 0.66,
        c[3]! * h * 0.5,
      );
      acc.snow += ell(cx, cy - c[3]! * h * 0.5, c[2]! * h * 0.8, c[3]! * h * 0.42);
    });
  };
  const bareD = (x0: number, y0: number, r2: number): string =>
    `M${x0},${y0}v${f(-r2 * 1.5)}M${x0},${f(y0 - r2 * 0.9)}l${f(-r2 * 0.8)},${f(-r2 * 1.1)}M${x0},${f(y0 - r2 * 1.1)}l${f(r2 * 0.85)},${f(-r2)}` +
    `M${x0},${f(y0 - r2 * 1.5)}l${f(-r2 * 0.35)},${f(-r2 * 0.9)}M${x0},${f(y0 - r2 * 1.5)}l${f(r2 * 0.4)},${f(-r2 * 0.8)}` +
    `M${f(x0 - r2 * 0.5)},${f(y0 - r2 * 1.6)}l${f(-r2 * 0.5)},${f(-r2 * 0.25)}M${f(x0 + r2 * 0.55)},${f(y0 - r2 * 1.75)}l${f(r2 * 0.5)},${f(-r2 * 0.15)}`;
  const leafless = s.season === 'winter' || cover2;
  const leafTree = (x: number, yb: number, r: number, acc: Acc, ci: number): void => {
    if (leafless) {
      acc.bare += bareD(x, yb, r);
      return;
    }
    const cx = x + lean * r * 2.8;
    const cy = yb - r * 2.2;
    const side = lightRight(x) ? -1 : 1;
    acc.trunk += `M${f(x - r * 0.13)},${yb}L${f(cx - r * 0.08)},${f(cy + r * 0.3)}L${f(cx + r * 0.08)},${f(cy + r * 0.3)}L${f(x + r * 0.13)},${yb}Z`;
    [
      [-0.55, 0.1, 0.6],
      [0.05, -0.55, 0.72],
      [0.7, -0.1, 0.62],
      [0.2, 0.35, 0.6],
      [-0.25, -0.25, 0.6],
      [0.5, -0.5, 0.5],
    ].forEach((l) => {
      acc.crown[ci % 3] += circ(cx + l[0]! * r, cy + l[1]! * r, l[2]! * r);
    });
    acc.crownShade +=
      circ(cx + side * 0.35 * r, cy + 0.36 * r, 0.48 * r) +
      circ(cx + side * 0.62 * r, cy - 0.02 * r, 0.36 * r);
  };
  const birch = (x: number, yb: number, h: number, acc: Acc, ci: number): void => {
    const k = lean * h * 0.7;
    const tx = x + k;
    const ty = yb - h * 0.8;
    acc.birch += `M${f(x - h * 0.03)},${yb}L${f(tx - h * 0.012)},${f(ty)}L${f(tx + h * 0.012)},${f(ty)}L${f(x + h * 0.03)},${yb}Z`;
    acc.marks += `M${f(x - h * 0.02)},${f(yb - h * 0.16)}h${f(h * 0.035)}M${f(x - h * 0.01 + k * 0.4)},${f(yb - h * 0.36)}h${f(h * 0.03)}M${f(x - h * 0.012 + k * 0.7)},${f(yb - h * 0.55)}h${f(h * 0.028)}`;
    if (leafless) {
      acc.bare += `M${f(tx)},${f(ty)}l${f(-h * 0.16)},${f(-h * 0.2)}M${f(tx)},${f(ty)}l${f(h * 0.14)},${f(-h * 0.22)}M${f(tx)},${f(ty)}v${f(-h * 0.2)}M${f(x + k * 0.6)},${f(yb - h * 0.55)}l${f(-h * 0.2)},${f(-h * 0.14)}M${f(x + k * 0.7)},${f(yb - h * 0.62)}l${f(h * 0.2)},${f(-h * 0.12)}`;
      return;
    }
    [
      [-0.15, -0.62, 0.13],
      [0.12, -0.7, 0.14],
      [0, -0.86, 0.13],
      [-0.2, -0.8, 0.1],
      [0.2, -0.88, 0.1],
      [0.04, -1.0, 0.1],
      [0.24, -0.58, 0.09],
    ].forEach((l) => {
      acc.crown[ci % 3] += circ(x + k * -l[1]! + l[0]! * h, yb + l[1]! * h, l[2]! * h);
    });
  };
  const bush = (x: number, yb: number, r: number, acc: Acc): void => {
    acc.full +=
      circ(x - r, yb - r * 0.6, r * 0.8) + circ(x, yb - r, r) + circ(x + r, yb - r * 0.6, r * 0.8);
  };
  const plant = (list: readonly Tree[], acc: Acc): void => {
    list.forEach((tr, i) => {
      const kd = tr[0];
      if (kd === 'spruce') spruce(tr[1], tr[2], tr[3], acc, 500 + i * 7 + tr[1]);
      else if (kd === 'fir') spruce(tr[1], tr[2], tr[3], acc, 500 + i * 7 + tr[1], true);
      else if (kd === 'pine') pine(tr[1], tr[2], tr[3], acc);
      else if (kd === 'birch') birch(tr[1], tr[2], tr[3], acc, i);
      else if (kd === 'leaf') leafTree(tr[1], tr[2], tr[3], acc, i);
      else bush(tr[1], tr[2], tr[3], acc);
    });
  };
  const paint = (acc: Acc, part: string, far?: boolean, cls = ''): void => {
    out += `<g data-part="${part}"${cls}>`;
    if (acc.trunk) path(acc.trunk, C.wood);
    if (acc.full) path(acc.full, far ? C.f2 : cover2 ? C.near : B.mix(C.near, C.dark, 0.45));
    if (acc.shade) path(acc.shade, C.dark, { opacity: far ? 0.3 : 0.45 });
    if (s.snowCover && acc.snow)
      path(acc.snow, C.snow, { opacity: cover2 ? 1 : 0.6, 'data-part': 'caps' });
    else if (s.frost && acc.snow) path(acc.snow, C.rime, { opacity: far ? 0.2 : 0.4 });
    if (acc.birch) {
      path(acc.birch, lit('birch'));
      line(acc.marks, C.dark, 0.9, { opacity: 0.7 });
    }
    acc.crown.forEach((d, ci) => {
      if (d) path(d, C.crowns[ci % C.crowns.length]!);
    });
    if (acc.crownShade) path(acc.crownShade, C.dark, { opacity: 0.28 });
    if (acc.bare) {
      line(acc.bare, cover2 ? C.wood : C.dark, 1.8);
      if (s.frost || s.snowCover)
        line(acc.bare, s.snowCover ? C.snow : C.rime, 0.9, {
          opacity: s.snowCover ? 0.9 : 0.55,
          transform: 'translate(-0.6 -0.9)',
        });
    }
    out += '</g>';
  };
  const leafy = (
    lineKeys: readonly Pt[],
    seed: number,
    n3: number,
    r0: number,
    r1: number,
    col: string,
    op: number,
  ): void => {
    if (leafless) return;
    const q = prng(seed);
    let d = '';
    const end = lineKeys[lineKeys.length - 1]![0];
    for (let i3 = 0; i3 < n3; i3++) {
      const x = q() * end;
      const r = r0 + q() * (r1 - r0);
      d +=
        circ(x + lean * r, yAt(lineKeys, x) + r * 0.2 + q() * r, r) +
        circ(x + r * 0.9 + lean * r, yAt(lineKeys, x) + r * 0.7 + q() * r * 0.5, r * 0.75);
    }
    path(d, hz(col), { opacity: op, 'data-layer': 'ridgeMid', 'data-part': 'leafy' });
  };
  skyline(G.f1, 61, 8, 13, 9, 15, C.f1, [1, 0.8, 0.45][s.fog]!);
  leafy(G.f1, 64, 46, 3, 5, B.mix(C.crowns[0] ?? C.f1, C.haze, 0.3), [0.9, 0.7, 0.35][s.fog]!);
  if (s.fog) {
    open('fog');
    fogBand(222, 20, 0.5);
    if (s.fog >= 2) fogBand(240, 26, 0.6);
    close();
  }

  /* ---- the lake: round, whole, in a meadow; far houses, jetty and boat ---- */
  open('water');
  const shoreCol = cover2
    ? B.mix(C.snow, C.snowShade, 0.3)
    : s.snowCover
      ? B.mix(C.meadow, C.snow, 0.6)
      : B.mix(C.meadow, C.f1, 0.3);
  const wq = prng(71);
  path(G.backShore, shoreCol, { 'data-part': 'shore' });
  let hw = '';
  let hr = '';
  let hwin = '';
  G.farHouses.forEach((h0, hi) => {
    const w = hi % 2 ? 8 : 10;
    hw += `M${h0[0]},${h0[1]}v-5h${w}v5Z`;
    hr += `M${h0[0] - 1.5},${h0[1] - 5}l${w / 2 + 1.5},-4.5l${w / 2 + 1.5},4.5Z`;
    hwin += `M${h0[0] + w - 4},${f(h0[1] - 3.8)}h2v2h-2Z`;
  });
  path(hw, B.mix(C.wall, C.haze, 0.25), { 'data-part': 'farHouses' });
  path(hr, s.snowCover ? C.snow : B.mix(C.roof, C.haze, 0.2));
  if (C.lightsOn) path(hwin, 'window', { 'data-part': 'window' });
  line(G.lake, B.mix(shoreCol, cover2 ? C.snowShade : C.haze, 0.5), 3.4, { 'data-part': 'rim' });
  path(G.lake, frozen ? C.ice : C.water, { 'data-part': 'lake' });
  const lc = id('c');
  defs += el('clipPath', { id: lc }, el('path', { d: G.lake }));
  out += `<g clip-path="url(#${lc})">`;
  if (!frozen && !s.fog && s.wind <= 1) {
    let rf = 'M1002,262';
    for (let x = 1002; x <= 1342; x += 10) {
      let top2 = 218;
      G.mountains.forEach((m) => {
        if (x >= m.sil[0]![0] && x <= m.sil[m.sil.length - 1]![0])
          top2 = Math.min(top2, yAt(m.sil, x));
      });
      rf += `L${x},${f(263 + (218 - top2) * 0.3)}`;
    }
    path(`${rf}L1342,262Z`, C.far, { opacity: s.wind ? 0.28 : 0.5, 'data-part': 'mirror' });
  }
  if (frozen) {
    path(
      'M1010,276l60,-5l44,6l-52,5ZM1150,286l70,-5l56,6l-60,6ZM1236,270l50,-2l30,4l-44,3Z',
      cover2 ? C.snow : C.iceHi,
      { opacity: 0.85, 'data-part': 'ice' },
    );
    line('M1020,290l80,-6M1110,272l60,3M1200,294l90,-3M1060,282l30,2', C.iceHi, 1.6);
  } else {
    let wd = '';
    if (hasBody && mode !== 'schein' && Math.abs(body[0] - 1170) < 160 && s.wind <= 2) {
      for (let i = 0; i < 5; i++) {
        const ww2 = 6 + i * 5 + wq() * 14;
        wd += `M${f(body[0] - ww2 / 2 + (wq() - 0.5) * 16)},${f(271 + i * 5.6 + wq() * 2)}h${f(ww2)}`;
      }
      line(wd, C.waterHi, 1.7, { opacity: 0.6, 'data-part': 'glitter' });
    }
    const nRip = [0, 7, 16, 26][s.wind]! + (falling === 'rain' ? 6 * s.intensity : 0);
    let rd2 = '';
    let caps2 = '';
    for (let i = 0; i < nRip; i++) {
      const cx2 = 1010 + wq() * 316;
      const cy2 = 268 + wq() * 30;
      rd2 += `M${f(cx2)},${f(cy2)}l7,-2.5l7,2.5`;
      if (s.wind === 3 && i % 3 === 0) caps2 += `M${f(cx2)},${f(cy2)}l7,-3.4l7,3.4l-7,-1Z`;
    }
    if (rd2) line(rd2, C.waterHi, 1.5, { opacity: 0.7, 'data-part': 'ripples' });
    if (caps2) path(caps2, 'white', { opacity: 0.75, 'data-part': 'whitecaps' });
  }
  out += '</g>';
  if (s.frost === 1 && !frozen) line(G.lake, C.rime, 2, { opacity: 0.5, 'data-part': 'iceRim' });
  path(`M${G.jetty[0] + 6},${G.jetty[1]}l-36,-3.6v2.6l36,3.8Z`, C.wood, { 'data-part': 'jetty' });
  line(`M${G.jetty[0] - 26},${G.jetty[1] - 2}v5M${G.jetty[0] - 10},${G.jetty[1]}v5`, C.wood, 1.6);
  out += el(
    'g',
    {
      transform: `translate(${G.boat[0]} ${G.boat[1]}) rotate(${frozen ? 0 : s.wind * 2.5 * dir})`,
      'data-part': 'boat',
    },
    el('path', { d: 'M-12,-3.4h24l-3,5.2q-9,2.4 -18,0Z', fill: C.wall }) +
      el('path', { d: 'M-12,-3.4h24l-1,1.6h-22Z', fill: B.mix(C.wall, C.dark, 0.5) }),
  );
  close();
  skyline(G.f2, 62, 12, 19, 16, 26, C.f2, [1, 0.9, 0.7][s.fog]!);
  leafy(G.f2, 65, 30, 5, 8, B.mix(C.crowns[1] ?? C.f2, C.haze, 0.12), [0.95, 0.8, 0.5][s.fog]!);
  open('ridgeMid', s.fog >= 2 ? ' opacity="0.7"' : '');
  {
    const acc = newAcc();
    const q = prng(63);
    let x = 1356;
    let i2 = 0;
    while (x < 1610) {
      spruce(x, 268 - (x - 1356) * 0.035 + q() * 4, 24 + q() * 24, acc, 700 + i2++, q() > 0.6);
      x += 9 + q() * 12;
    }
    paint(acc, 'staffel', true);
  }
  close();
  if (s.fog >= 2) {
    open('fog');
    fogBand(252, 30, 0.6);
    close();
  }

  /* ---- foreground: round ground, way, buildings, smoke, fence, flag, trees ---- */
  open('ridgeNear');
  const gfill = cover2 ? C.snow : s.snowCover ? B.mix(C.meadow, C.snow, 0.7) : C.meadow;
  const gy = (x: number): number => yAt(G.ground, x) + 2;
  path(smooth(G.ground, H), gfill, { 'data-part': 'ground' });
  path(
    'M-20,320L-20,307Q240,298 520,309T990,309Q1160,318 1340,311Q1461.3,293.3 1600,290.3L1600,320Z',
    cover2 ? C.snowShade : C.near,
    { opacity: cover2 ? 0.5 : 0.32, 'data-part': 'fold' },
  );
  if (s.sun >= 2 && !s.snowCover)
    path(
      'M880,296Q940,292 990,300Q940,298 880,301Z M1380,284Q1470,270 1600,270Q1500,276 1400,292Z',
      B.mix(C.meadow, 'sunband', 0.3),
      { opacity: 0.55, 'data-part': 'sunband' },
    );
  if (s.frost && !s.snowCover)
    line(smooth(G.ground), C.rime, 2.6, { opacity: 0.45, 'data-part': 'hoar' });
  path(G.way, cover2 ? C.snowShade : B.mix(gfill, C.haze, 0.35), {
    opacity: cover2 ? 0.7 : 0.85,
    'data-part': 'way',
  });
  if (s.sun >= 2 || (dark && mode === 'clear' && moonBody && moonIllum > 0.9 && cover2)) {
    let shd = '';
    G.trees.forEach((tr) => {
      if (tr[0] === 'bush' || tr[2] < 262) return;
      const h = tr[0] === 'leaf' ? tr[3] * 3 : tr[3];
      const dx = (tr[1] - body[0]) * 0.5;
      const l = h * 0.5;
      shd += `M${f(tr[1] - 5)},${tr[2]}L${f(tr[1] + 5)},${tr[2]}L${f(tr[1] + dx * 0.35 + 9)},${f(tr[2] + l)}L${f(tr[1] + dx * 0.35 - 12)},${f(tr[2] + l)}Z`;
    });
    shd += 'M1404,266L1490,263L1530,284L1424,290Z';
    path(shd, cover2 ? C.snowShade : C.dark, {
      opacity: (cover2 ? 0.8 : 0.26) * (s.sun === 2 ? 0.6 : 1),
      'data-part': 'shadows',
    });
  }
  const sway = motion && s.wind >= 2 ? ` class="sc-sway" style="--dir:${dir}"` : '';
  const accB = newAcc();
  plant(G.behind, accB);
  paint(accB, 'treesBehind', false, sway);
  const building = (at: readonly [number, number, number], cabin: boolean): void => {
    let b = '';
    const wallS = B.mix(C.wall, C.dark, 0.42);
    const roofC = s.snowCover ? C.snow : C.roof;
    const win = C.lightsOn ? tok('window') : B.mix(C.wall, C.dark, 0.72);
    if (cabin)
      b +=
        el('path', { d: 'M48,-56h8v14h-8Z', fill: B.mix(C.roof, C.haze, 0.25) }) +
        el('path', { d: 'M46.5,-57.5h11v3h-11Z', fill: s.snowCover ? C.snow : C.roof });
    b +=
      el('path', { d: 'M34,0v-20l40,-3v20Z', fill: wallS }) +
      el('path', { d: 'M0,0v-20l17,-17l17,17v20Z', fill: C.wall });
    if (cabin)
      b += el('path', {
        d: 'M0,-5h34M0,-10h34M0,-15h34M34,-6l40,-3M34,-11.5l40,-3',
        fill: 'none',
        stroke: C.dark,
        'stroke-width': 0.7,
        opacity: 0.28,
      });
    b +=
      el('path', {
        d: 'M15,-39.4l44,-3.3l19,21.6l-44,3.3Z',
        fill: roofC,
        'data-part': s.snowCover ? 'caps' : null,
      }) +
      el('path', {
        d: 'M-4.5,-16.5l19.5,-23l3,2.6l-19.5,22.6Z',
        fill: s.snowCover ? C.snowShade : B.mix(C.roof, C.dark, 0.35),
      });
    if (s.snowCover >= 2 && cabin)
      b += el('path', {
        d: 'M15,-42.4l44,-3.3l2,2.4l-44,3.3Z',
        fill: C.snow,
        'data-part': 'roofLoad',
      });
    b += el('path', {
      d: cabin ? 'M12,0v-12h8v12Z' : 'M9,0v-13h14v13Z',
      fill: B.mix(C.wall, C.dark, 0.62),
    });
    if (cabin)
      b +=
        el('path', {
          d: 'M14,-27h6v5.5h-6ZM42,-15l8,-0.6v7l-8,0.6ZM58,-16.2l8,-0.6v7l-8,0.6Z',
          fill: win,
          'data-part': 'window',
        }) +
        el('path', { d: 'M76,0v-6q7,-2.4 14,0v6Z', fill: C.wood }) +
        el('path', {
          d: 'M79,-3h.1M83,-4h.1M87,-3h.1M81,-1h.1M85,-1h.1',
          stroke: B.mix(C.wood, C.haze, 0.5),
          'stroke-width': 1.6,
          'stroke-linecap': 'round',
        });
    out += el(
      'g',
      {
        transform: `translate(${at[0]} ${at[1]}) scale(${at[2]})`,
        'data-part': cabin ? 'cabin' : 'shed',
      },
      b,
    );
  };
  building(G.shed, false);
  building(G.cabin, true);
  if (C.lightsOn)
    out += glow(G.cabin[0] + 62, G.cabin[1] - 14, 30, 30, [
      [0, 'window', 0.3],
      [1, 'window', 0],
    ]);
  let fd = '';
  [
    [1384, 1406],
    [1452, 1612],
  ].forEach((seg) => {
    let r1 = '';
    let r2 = '';
    for (let x = seg[0]!; x <= seg[1]!; x += 16) {
      const y = gy(x) + 12;
      fd += `M${x},${f(y + 1)}v-12`;
      r1 += `${r1 ? 'L' : 'M'}${x},${f(y - 8)}`;
      r2 += `${r2 ? 'L' : 'M'}${x},${f(y - 3.5)}`;
    }
    fd += r1 + r2;
  });
  line(fd, cover2 ? C.wood : C.dark, 1.9, { opacity: cover2 ? 0.75 : 1, 'data-part': 'fence' });
  // smoke shows the wind: 0 a column that spreads · 1 it leans · 2 a flat streak · 3 torn off the chimney
  const sx0 = G.cabin[0] + 52 * G.cabin[2];
  const sy0 = G.cabin[1] - 57.5 * G.cabin[2];
  let sm = '';
  const sq = prng(81);
  if (s.wind <= 1)
    for (let i = 0; i < 6; i++)
      sm += circ(
        sx0 + (sq() - 0.5) * (3 + i * 2) + i * (s.wind ? 7 * dir : 0.8),
        sy0 - 5 - i * (s.wind ? 8 : 10),
        3.2 + i * 1.7,
      );
  else if (s.wind === 2)
    sm = `M${f(sx0)},${f(sy0)}q${6 * dir},-7 ${26 * dir},-9q${34 * dir},-3 ${66 * dir},-1q${-30 * dir},6 ${-58 * dir},8q${-22 * dir},2 ${-30 * dir},6Z`;
  else
    sm = `M${f(sx0)},${f(sy0)}q${5 * dir},-4 ${20 * dir},-4q${14 * dir},1 ${26 * dir},3q${-16 * dir},1 ${-28 * dir},2Z M${f(sx0 + 58 * dir)},${f(sy0 - 3)}q${12 * dir},-3 ${30 * dir},0q${-14 * dir},2 ${-30 * dir},0Z`;
  path(sm, C.smoke, { opacity: 0.85, 'data-part': 'smoke', class: motion ? 'sc-smoke' : null });
  // flag at the lake: 0 hangs · 1 half out · 2 straight out · 3 straight, frayed, the pole bends
  const fx = G.flag[0];
  const fy = G.flag[1];
  const bend = s.wind === 3 ? 4 * dir : 0;
  const tx0 = fx + bend;
  const ty0 = fy - 59;
  line(`M${fx},${fy}Q${fx},${fy - 30} ${tx0},${fy - 60}`, cover2 ? C.wood : C.dark, 2.2, {
    'data-part': 'pole',
  });
  const cloth =
    s.wind === 0
      ? `M${tx0},${ty0}l${8 * dir},3l${-2 * dir},22l${-6 * dir},-4Z`
      : s.wind === 1
        ? `M${tx0},${ty0}q${12 * dir},1 ${22 * dir},9l${-3 * dir},14q${-9 * dir},-7 ${-19 * dir},-8Z`
        : `M${tx0},${ty0}q${10 * dir},-5 ${19 * dir},-1t${19 * dir},-1${s.wind === 3 ? `l${-5 * dir},4l${6 * dir},3l${-6 * dir},4l${4 * dir},4` : `l${-1 * dir},15`}q${-9 * dir},4 ${-18 * dir},1t${-19 * dir},2Z`;
  path(cloth, C.flag, {
    'data-part': 'flag',
    class: motion && s.wind >= 1 ? `sc-flag${dir < 0 ? ' sc-left' : ''}` : null,
  });
  const accT = newAcc();
  plant(G.trees, accT);
  paint(accT, 'trees', false, sway);
  if (!cover2) {
    let tf = '';
    const tq = prng(91);
    let dots = '';
    for (let i = 0; i < 30; i++) {
      const tx2 = 860 + tq() * 740;
      const ty = gy(tx2) + 6 + tq() * 20;
      const k3 = lean * 22;
      if (tx2 > 1000 && tx2 < 1345 && ty < 306) continue;
      tf += `M${f(tx2)},${f(ty)}l${f(-2 + k3)},-7M${f(tx2 + 3)},${f(ty)}l${f(1 + k3)},-9M${f(tx2 + 6)},${f(ty)}l${f(3 + k3)},-6`;
      if (i % 2) dots += circ(tx2 + 11, ty - 1, 1.5);
    }
    line(tf, s.frost || s.snowCover ? C.rime : B.mix(C.near, C.meadow, 0.4), 1.3, {
      opacity: s.frost ? 0.4 : 0.9,
      'data-part': 'grass',
    });
    if (s.season === 'spring' && !s.snowCover)
      path(dots, lit('flower'), { 'data-part': 'flowers' });
    if (s.season === 'autumn' && !s.snowCover) path(dots, lit('leaf'), { 'data-part': 'fallen' });
  }
  path(
    'M996,300q2,-8 9,-9q8,0 10,9Z M1334,296q2,-6 8,-6q6,1 7,6Z M1150,309q1,-4 6,-4q5,0 6,4Z M1060,307q1,-5 7,-5q6,1 7,5Z M1226,308q2,-6 8,-6q7,1 8,6Z M1244,309q1,-3 4,-3q4,0 5,3Z',
    cover2 ? B.mix(C.mid, C.snow, 0.4) : B.mix(C.far, C.dark, 0.25),
    { 'data-part': 'rocks' },
  );
  if (cover2 && (s.sun >= 2 || s.frost >= 2)) {
    let sp2 = '';
    const pq2 = prng(95);
    for (let i = 0; i < 8; i++) {
      const px = 900 + pq2() * 680;
      const py = 296 + pq2() * 20;
      sp2 += `M${f(px)},${f(py - 4)}l1,3l3,1l-3,1l-1,3l-1,-3l-3,-1l3,-1Z`;
    }
    path(sp2, 'white', { 'data-part': 'sparkle' });
  }
  if (s.wet && !cover2) {
    const pn = Math.max(1, s.thunder >= 3 ? 3 : s.intensity);
    path(
      [
        'M1462,304a26,4.5 0 1,0 52,0a26,4.5 0 1,0 -52,0Z',
        'M1540,312a20,3.6 0 1,0 40,0a20,3.6 0 1,0 -40,0Z',
        'M905,310a22,4 0 1,0 44,0a22,4 0 1,0 -44,0Z',
      ]
        .slice(0, pn)
        .join(''),
      C.water,
      { opacity: 0.9, 'data-part': 'puddles' },
    );
    line(
      ['M1478,304a10,2 0 1,0 20,0', 'M1554,312a7,1.6 0 1,0 14,0', 'M918,310a8,1.8 0 1,0 16,0']
        .slice(0, pn)
        .join(''),
      C.waterHi,
      1.2,
      { opacity: 0.8 },
    );
  }
  if (s.heat)
    line(
      'M1010,250q14,-4 28,0t28,0M1120,256q14,-4 28,0t28,0M1400,244q14,-4 28,0t28,0M930,262q12,-3 24,0t24,0',
      'heat-haze',
      1.4,
      { opacity: 0.7, 'data-part': 'shimmer' },
    );
  close();
  if (s.fog >= 2) {
    open('fog');
    add('rect', {
      x: q0 - 80,
      y: top,
      width: W - (q0 - 80),
      height: H - top,
      fill: fogG ?? fogC,
      opacity: 0.24,
      'data-part': 'veil',
    });
    fogBand(278, 22, 0.5, 860, 520);
    close();
  }

  /* ---- bolts: they never flash; the glow at the cloud brightens once (CONCEPT §7) ---- */
  if (s.thunder) {
    open('event', ' data-part="thunder"');
    const glowA = {
      cx: G.glow[0],
      cy: G.glow[1],
      r: G.glow[2],
      fill: radial('bolt', 0.34, 0),
      'data-part': 'glow',
    };
    add('circle', glowA);
    // the hidden copy that brightens once, 1.2 s up and 1.2 s down from second 1: at rest the picture is the still
    if (motion) add('circle', { ...glowA, class: 'sc-glow-up', 'data-part': 'glowUp' });
    G.bolts.slice(0, [0, 1, 2, 4][s.thunder]).forEach((b) => {
      let d = ribbon(b.p, b.w, 0.7);
      const core = pts(b.p);
      b.forks.forEach((fk) => {
        d += ribbon(fk, b.w * 0.45, 0.4);
      });
      path(d, 'bolt', {
        opacity: b.op,
        stroke: tok('bolt'),
        'stroke-width': 0.6,
        'data-part': 'bolt',
      });
      line(core, 'bolt-core', Math.max(0.7, b.w * 0.3), { opacity: b.op });
    });
    close();
  }

  /* ---- precipitation ---- */
  const showers = /howers/.test(s.cond) || s.thunder === 1;
  const px0 = showers ? 1060 : -120;
  const px1 = showers ? 1500 : W;
  const slant = G.slant[s.wind]! * dir;
  // motion.js's tile loop as ONE iteration (perf, open item of round 1): the tile stacked n + 1 heights up (and against
  // the slant) moves by n tiles in 5 s and ends on the still. n iterations of one tile restyled the page at every
  // iteration boundary (docs/perf/WEATHER-SCENES-2026-11.md).
  const fall = (inner: string, splash: string, snow: boolean): string => {
    if (!motion) return inner + splash;
    const T = snow ? H - top : 190;
    const fx2 = slant * T * (snow ? 0.5 : 1);
    const dur = snow ? 5 : /rizzle/.test(s.cond) ? 5 / 6 : 0.5;
    const n2 = Math.round(5 / dur);
    let clipAttr = '';
    if (!snow) {
      const cid = id('p');
      defs += el(
        'clipPath',
        { id: cid },
        el('rect', { x: -400, y: showers ? 104 : 124, width: 2400, height: H + 40 }),
      );
      clipAttr = ` clip-path="url(#${cid})"`;
    }
    // The stack by doubling: each step repeats what is there one stack higher with a `<use>` (log2(n + 1) of them),
    // so the markup is not multiplied.
    let tile = id('t');
    let stack = `<g id="${tile}">${inner}</g>`;
    for (let h = 1; h < n2 + 1; h *= 2) {
      const up = `<use href="#${tile}" transform="translate(${f(-fx2 * h)} ${f(-T * h)})"/>`;
      if (h * 2 >= n2 + 1) stack += up;
      else {
        tile = id('t');
        stack = `<g id="${tile}">${stack}${up}</g>`;
      }
    }
    return `<g${clipAttr}><g class="sc-fall" style="--fx:${f(fx2 * n2)}px;--fy:${f(T * n2)}px;--dur:5s;--n:1">${stack}</g>${splash}</g>`;
  };
  if (falling === 'rain') {
    const drizzle = /rizzle/.test(s.cond);
    const lvl = s.thunder >= 3 ? 3 : s.intensity;
    const cnt = Math.round((drizzle ? 60 : G.rain[lvl]!) * (showers ? 0.45 : 1));
    const rq = prng(101);
    let back = '';
    let front = '';
    let quiet = '';
    let spl = '';
    const l0 = drizzle ? 6 : [0, 9, 13, 15][lvl]!;
    const l1 = drizzle ? 4 : [0, 5, 8, 13][lvl]!;
    for (let i = 0; i < cnt; i++) {
      const rx2 = px0 + rq() * (px1 - px0);
      const ry = (showers ? 104 : 124) + rq() * 190;
      const len = l0 + rq() * l1;
      const seg = `M${f(rx2)},${f(ry)}l${f(len * slant)},${f(len)}`;
      if (rx2 < 880) {
        if (i % 2) quiet += seg;
      } else if (i % 3) front += seg;
      else back += seg;
    }
    const nSpl = drizzle ? 0 : [0, 0, 10, 26][lvl]!;
    for (let i = 0; i < nSpl; i++) {
      const px2 = 900 + rq() * 690;
      const py2 = px2 > 985 && px2 < 1345 ? 266 + rq() * 30 : yAt(G.ground, px2) + 2 + rq() * 20;
      spl += `M${f(px2 - 3.5)},${f(py2 - 3)}l3.5,3l4,-3.6`;
    }
    const inner =
      (quiet ? el('path', { d: quiet, 'stroke-width': 1.2, opacity: 0.22 }) : '') +
      el('path', { d: back, 'stroke-width': drizzle ? 0.9 : 1.1, opacity: 0.4 }) +
      el('path', {
        d: front,
        'stroke-width': drizzle ? 1.1 : [0, 1.3, 1.6, 1.9][lvl]!,
        opacity: [0, 0.55, 0.65, 0.7][lvl]!,
        'data-part': 'rain',
      });
    const splash = spl
      ? el('path', { d: spl, 'stroke-width': 1.2, opacity: 0.75, 'data-part': 'splash' })
      : '';
    out += `<g data-layer="precip" fill="none" stroke="${tok('rain')}" stroke-linecap="round" data-level="${drizzle ? 'drizzle' : lvl}">${fall(inner, splash, false)}</g>`;
    if (/reezing/.test(s.cond))
      line(pts(G.ground), C.iceHi, 2.2, { opacity: 0.8, 'data-part': 'glaze' });
    if (s.cond === 'thunderHail') {
      let hd2 = '';
      let hl = '';
      const hq2 = prng(105);
      for (let i = 0; i < 40; i++) {
        const hx3 = 900 + hq2() * 690;
        const hy3 = 130 + hq2() * 180;
        hd2 += circ(hx3, hy3, 1.2 + hq2() * 0.8);
        hl += `M${f(hx3 - slant * 7)},${f(hy3 - 7)}L${f(hx3)},${f(hy3)}`;
      }
      out += `<g data-layer="precip" data-part="hail">${el('path', { d: hl, fill: 'none', stroke: tok('hail'), 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.6 })}${el('path', { d: hd2, fill: tok('hail'), stroke: tok('hail-edge'), 'stroke-width': 0.5 })}</g>`;
    }
  }
  if (falling === 'snow') {
    const cs = Math.round(G.snow[s.intensity]! * (showers ? 0.45 : 1));
    const nq = prng(103);
    let a1 = '';
    let a2 = '';
    let a3 = '';
    for (let i = 0; i < cs; i++) {
      const nx = px0 + nq() * (px1 - px0) + slant * 30;
      const ny = top + nq() * (H - top);
      const r3 = 1 + nq() * (s.intensity >= 3 ? 2.2 : 1.4);
      const c1 = circ(nx, ny, r3);
      if (nx < 880) {
        if (i % 2) a3 += circ(nx, ny, r3 * 0.8);
      } else if (i % 3) a1 += c1;
      else a2 += circ(nx, ny, r3 * 0.7);
    }
    const inner =
      (a3 ? el('path', { d: a3, opacity: 0.35 }) : '') +
      el('path', { d: a2, opacity: 0.6 }) +
      el('path', { d: a1, opacity: 0.95, 'data-part': 'flakes' });
    out += `<g data-layer="precip" fill="${C.snow}" data-level="${s.intensity}">${fall(inner, '', true)}</g>`;
  }

  /* ---- wind: things in the air ---- */
  if (s.wind >= 2) {
    let lf = '';
    const lq2 = prng(111);
    const cntL = s.wind === 3 ? 16 : 8;
    open('wind');
    if (cover2) {
      let dd = '';
      for (let i = 0; i < cntL / 2; i++) {
        const dx2 = 960 + lq2() * 560;
        const dy2 = 240 + lq2() * 60;
        dd += `M${f(dx2)},${f(dy2)}q${f(dir * 30)},-7 ${f(dir * 64)},-2q${f(-dir * 30)},0 ${f(-dir * 64)},2Z`;
      }
      path(dd, C.snow, { opacity: 0.7, 'data-part': 'dust' });
    } else {
      // one leaf in <defs>, placed with <use> (A11Y §4 markup ceiling); it takes the group's fill
      const leaf = id('l');
      defs += el('path', { id: leaf, d: 'M-4,0q4,-3.5 8,0q-4,3.5 -8,0Z' });
      for (let i = 0; i < cntL; i++)
        lf += `<use href="#${leaf}" transform="translate(${f(980 + lq2() * 560)} ${f(150 + lq2() * 110)}) rotate(${f(lq2() * 60 - 30)})"/>`;
      out += `<g fill="${lit(s.season === 'autumn' ? 'leaf' : 'leaf-green')}" opacity="0.9" data-part="leaves" data-count="${cntL}">${lf}</g>`;
    }
    line(
      dir > 0
        ? 'M1040,214q40,-9 84,-2M1270,232q34,-8 70,-1M1108,246q26,-6 52,-1'
        : 'M1124,214q-40,-9 -84,-2M1340,232q-34,-8 -70,-1M1160,246q-26,-6 -52,-1',
      'rain',
      1.3,
      { opacity: 0.35, 'data-part': 'streaks' },
    );
    close();
  }
  return finish();

  /** The porthole after its summit: the main bolt (wider, so it reads at 28 px) and a few marks of rain or snow. */
  function portholeRest(): SceneSvg {
    if (s.thunder) {
      open('event', ' data-part="thunder"');
      // the main bolt's figure, moved into the round crop (its own place lies on the crop's left rim)
      const b = G.bolts[0]!;
      path(ribbon(b.p, b.w * 2.4, 1.6), 'bolt', {
        opacity: b.op,
        transform: `translate(${PORTHOLE.boltDx} 0)`,
        'data-part': 'bolt',
      });
      close();
    }
    if (falling) {
      const q = prng(41);
      const cnt = (pt < 48 ? 5 : 7) + Math.min(3, s.intensity);
      const slant = G.slant[s.wind]! * dir;
      const snowy = falling === 'snow';
      let d = '';
      for (let i = 0; i < cnt; i++) {
        const x = view[0] + 40 + ((i + q() * 0.6) * (view[2] - 90)) / cnt;
        const y = 116 + ((i * 37) % 64) + q() * 12;
        d += snowy ? circ(x, y, 5.5) : `M${f(x)},${f(y)}l${f(22 * slant)},22`;
      }
      open('precip', ` data-level="${s.intensity}"`);
      if (snowy) path(d, C.snow, { 'data-part': 'flakes' });
      else line(d, 'rain', 4, { 'stroke-linecap': 'round', opacity: 0.85, 'data-part': 'rain' });
      if (s.cond === 'thunderHail') {
        let hd2 = '';
        for (let i = 0; i < 4; i++) hd2 += circ(view[0] + 90 + i * 52, 150 + ((i * 29) % 50), 6);
        path(hd2, 'hail', { stroke: tok('hail-edge'), 'stroke-width': 1.5, 'data-part': 'hail' });
      }
      close();
    }
    return finish();
  }

  /* ============================== sky events (mockups/events.js) ============================== */
  function moreStars(count: number, seed: number): string {
    const q = prng(seed);
    const d = ['', '', ''];
    for (let i = 0; i < count; i++) {
      const x = E.left + q() * (W - E.left);
      const y = top + q() * (150 - top);
      const r = 0.5 + q() * 0.9;
      if (Math.hypot(x - body[0], y - body[1]) < 46) continue;
      d[i % 3] += circ(x, y, r);
    }
    return [0.45, 0.7, 0.95]
      .map((op, j) => (d[j] ? el('path', { d: d[j], fill: tok('star'), opacity: op }) : ''))
      .join('');
  }
  /** Slot `sky`: after the sky and the stars, before the body. */
  function eventSky(): string {
    const ev = s.event;
    if (!ev) return '';
    if (ev === 'meteors') {
      let o2 = '';
      E.meteors.forEach((m) => {
        const a = (32 * Math.PI) / 180;
        const tx = m[0] + Math.cos(a) * m[2];
        const ty = m[1] - Math.sin(a) * m[2];
        const g = grad(
          [
            [0, 'white', 0.95],
            [1, 'white', 0],
          ],
          { x1: m[0], y1: m[1], x2: f(tx), y2: f(ty), gradientUnits: 'userSpaceOnUse' },
        );
        o2 +=
          el('path', {
            d: `M${m[0]},${m[1]}L${f(tx)},${f(ty)}`,
            stroke: g,
            'stroke-width': 1.6,
            'stroke-linecap': 'round',
          }) + el('circle', { cx: m[0], cy: m[1], r: 1.6, fill: tok('star') });
      });
      return `<g data-layer="event" data-part="meteors">${o2}</g>`;
    }
    if (ev === 'starNight') {
      const M = E.milky;
      const q = prng(131);
      let md = '';
      const rot = (M.rot * Math.PI) / 180;
      const o2 = glow(
        M.cx,
        M.cy,
        M.rx,
        M.ry,
        [
          [0, 'white', 1],
          [1, 'white', 0],
        ],
        { opacity: M.op },
        M.rot,
      );
      for (let j = 0; j < M.n; j++) {
        const u = (q() * 2 - 1) * M.rx * 0.9;
        const v = (q() + q() - 1) * M.ry * 0.7;
        const x = M.cx + u * Math.cos(rot) - v * Math.sin(rot);
        if (x < E.left) continue;
        md += circ(x, M.cy + u * Math.sin(rot) + v * Math.cos(rot), 0.4 + q() * 0.5);
      }
      return `<g data-layer="stars" data-part="milky">${o2}${el('path', { d: md, fill: tok('star'), opacity: 0.8 })}${moreStars(86, 133)}</g>`;
    }
    if (ev === 'solarPartial')
      return amount(0.5) > 0.6
        ? el('rect', {
            x: 0,
            y: top,
            width: W,
            height: H - top,
            fill: tok('dim-target'),
            opacity: 0.3,
            'data-part': 'dim',
          })
        : '';
    if (ev === 'solarTotal')
      return `<g data-layer="stars">${moreStars(40, 141)}</g>${el('rect', {
        x: 0,
        y: 150,
        width: W,
        height: 100,
        fill: grad(
          [
            [0, 'glow-eclipse-sky', 0],
            [0.6, 'glow-eclipse-sky', 0.35],
            [1, 'glow-eclipse-sky', 0],
          ],
          { x1: 0, y1: 0, x2: 0, y2: 1 },
        ),
      })}`;
    if (ev === 'lunarTotal')
      return s.cover < 4 && !falling ? `<g data-layer="stars">${moreStars(60, 151)}</g>` : '';
    if (ev === 'aurora') return auroraLayer();
    return '';
  }
  function auroraLayer(): string {
    const A = E.aurora;
    const amt = amount(0.5);
    let o2 = '';
    const op = A.op[0]! + A.op[1]! * amt;
    const gl = A.glow;
    o2 += glow(
      Math.max(gl[0]!, A.left + 200),
      gl[1]!,
      f(gl[2]! * (0.6 + 0.4 * amt)),
      f(gl[3]! * (0.5 + 0.5 * amt)),
      [
        [0, 'aurora-1', 0.3 * amt + 0.08],
        [1, 'aurora-1', 0],
      ],
      { 'data-part': 'auroraGlow' },
    );
    const fill = grad(
      [
        [0, 'aurora-3', 0],
        [0.35, 'aurora-3', 0.45],
        [0.7, 'aurora-2', 0.85],
        [1, 'aurora-1', 1],
      ],
      { x1: 0, y1: 0, x2: 0, y2: 1 },
    );
    A.bands.slice(0, amt < 0.6 ? A.few : A.bands.length).forEach((b) => {
      const x0 = Math.max(b[0], A.left);
      const x1 = b[1];
      if (x1 - x0 < 90) return;
      const h = Math.min(A.h * Math.pow(amt, 1.15) * b[3] + 14, b[2] - A.top);
      const nn = 16;
      let tp = '';
      let base = '';
      for (let i = 0; i <= nn; i++) {
        const u = i / nn;
        const x = x0 + (x1 - x0) * u;
        const env = Math.pow(Math.sin(Math.PI * u), 0.55);
        const yb = b[2] + 7 * Math.sin(u * 7 + b[4]);
        const yt = yb - h * env * (0.82 + 0.18 * Math.sin(u * 11 + b[4] * 2));
        tp += `${i ? 'L' : 'M'}${f(x)},${f(yt)}`;
        base = `L${f(x)},${f(yb)}${base}`;
      }
      o2 += el('path', { d: `${tp}${base}Z`, fill, opacity: f(op * 100) / 100 });
      o2 += el('path', {
        d: `${tp}${base}Z`,
        fill,
        opacity: f(op * 60) / 100,
        transform: `translate(${f(x0 + (x1 - x0) * 0.5)} ${b[2]}) scale(0.62 0.8) translate(${f(-(x0 + (x1 - x0) * 0.42))} ${-b[2]})`,
      });
    });
    return `<g data-layer="aurora" data-part="aurora">${o2}</g>`;
  }
  /** Slot `body`: an event that draws the body itself; `null` = the plain body. */
  function eventBody(pale: boolean): string | null {
    const ev = s.event;
    const R = 25;
    if (
      (ev === 'solarPartial' || ev === 'solarAnnular' || ev === 'solarTotal') &&
      s.body.kind === 'sun'
    ) {
      bodyR = R;
      let o2 = '';
      if (ev === 'solarTotal') {
        let petals = '';
        for (let i = 0; i < 6; i++) {
          const a = i * 60 + 18 + (i % 2) * 9;
          const Lp = R * (i % 2 ? 1.55 : 1.85);
          const w = R * 0.55;
          petals += el('path', {
            d: `M0,${f(-w)}C${f(Lp * 0.6)},${f(-w)} ${f(Lp)},${f(-w * 0.25)} ${f(Lp)},0C${f(Lp)},${f(w * 0.25)} ${f(Lp * 0.6)},${f(w)} 0,${f(w)}Z`,
            transform: `rotate(${a})`,
          });
        }
        o2 += glow(0, 0, R * 2.8, R * 2.8, [
          [0, 'white', 0.85],
          [0.36, 'white', 0.45],
          [1, 'white', 0],
        ]);
        o2 +=
          el('g', { fill: 'white', opacity: 0.42, 'data-part': 'corona' }, petals) +
          el('circle', { r: R, fill: tok('eclipse-disc') });
        return wrapBody(o2);
      }
      const amt = ev === 'solarPartial' ? amount(0.5) : 0.85;
      o2 += glow(0, 0, R * 3.4, R * 3.4, [
        [0, 'sun-core', 0.6 * (1 - amt * 0.7)],
        [0.45, 'sun-core', 0.22 * (1 - amt * 0.7)],
        [1, 'sun-core', 0],
      ]);
      let disc =
        el('circle', { r: R, fill: tok('sun') }) +
        (ev === 'solarAnnular'
          ? el('circle', { r: R * 0.86, fill: tok('eclipse-disc'), 'data-part': 'annular' })
          : el('circle', { r: R * 0.62, fill: tok('sun-core') }));
      if (ev === 'solarPartial') {
        const m = id('m');
        const d = 2 * R * (1 - amt);
        const k = Math.SQRT1_2;
        const b = R * 1.2;
        defs += el(
          'mask',
          { id: m, maskUnits: 'userSpaceOnUse', x: -b, y: -b, width: 2 * b, height: 2 * b },
          el('rect', { x: -b, y: -b, width: 2 * b, height: 2 * b, fill: 'white' }) +
            el('circle', { cx: f(d * k), cy: f(-d * k), r: R + 0.5, fill: 'black' }),
        );
        disc = el('g', { mask: `url(#${m})`, 'data-part': 'bite' }, disc);
      }
      return wrapBody(o2 + disc);
    }
    if ((ev === 'lunarPartial' || ev === 'lunarTotal') && s.body.kind === 'moon') {
      const Rm = 24 * moonSize;
      bodyR = Rm;
      let o2 = '';
      if (ev === 'lunarTotal') {
        o2 += el('circle', {
          r: Rm,
          fill: grad(
            [
              [0, 'eclipse-red', 1],
              [0.7, 'eclipse-red', 1],
              [1, 'eclipse-red-dark', 1],
            ],
            { cx: 0.5, cy: 0.5, r: 0.5 },
            true,
          ),
          'data-part': 'copper',
        });
        o2 += el('path', {
          d:
            circ(Rm * 0.17, -Rm * 0.33, Rm * 0.23) +
            circ(-Rm * 0.12, Rm * 0.21, Rm * 0.17) +
            circ(Rm * 0.38, Rm * 0.3, Rm * 0.12),
          fill: tok('eclipse-red-dark'),
          opacity: 0.45,
        });
        return wrapBody(o2);
      }
      o2 += glow(0, 0, Rm * 2.7, Rm * 2.7, [
        [0, 'moon', pale ? 0.5 : 0.34],
        [1, 'moon', 0],
      ]);
      o2 += el('circle', { r: Rm, fill: tok('moon') });
      o2 += el('path', {
        d:
          circ(Rm * 0.17, -Rm * 0.33, Rm * 0.23) +
          circ(-Rm * 0.12, Rm * 0.21, Rm * 0.17) +
          circ(Rm * 0.38, Rm * 0.3, Rm * 0.12) +
          circ(-Rm * 0.33, -Rm * 0.17, Rm * 0.11),
        fill: tok('moon-mare'),
      });
      const cl = id('c');
      const ru = Rm * 2.6;
      const d = ru + Rm - amount(0.5) * 2 * Rm;
      const k = Math.SQRT1_2;
      defs += el('clipPath', { id: cl }, el('circle', { r: Rm }));
      o2 += el('circle', {
        cx: f(-d * k),
        cy: f(d * k),
        r: f(ru),
        fill: tok('eclipse-umbra'),
        opacity: 0.85,
        'clip-path': `url(#${cl})`,
        'data-part': 'umbra',
      });
      return wrapBody(o2);
    }
    if (ev === 'dust' && s.body.kind === 'sun') {
      bodyR = R;
      return wrapBody(
        el('circle', { r: R, fill: tok('dust-sun'), opacity: 0.78, 'data-part': 'dustSun' }),
      );
    }
    return null;
  }
  /** Slot `behindLand`: after the massif, before the hills. */
  function eventBehindLand(): string {
    if (s.event === 'rainbow') {
      const R = E.rainbow;
      let arcs = '';
      const q = prng(121);
      let cur = '';
      for (let i = 0; i < 40; i++) {
        const x = R.cx - R.r + 20 + q() * (2 * R.r - 40);
        const y = 120 + q() * 110;
        cur += `M${f(x)},${f(y)}l0.8,${f(9 + q() * 8)}`;
      }
      for (let i = 0; i < 5; i++) {
        const rr = R.r - R.w / 2 - i * R.w;
        arcs += el('path', {
          d: `M${R.cx - rr},${R.cy}A${rr},${rr} 0 0 1 ${R.cx + rr},${R.cy}`,
          fill: 'none',
          stroke: tok(`rb-${i + 1}`),
          'stroke-width': R.w + 0.4,
        });
      }
      const m = id('m');
      defs += el(
        'mask',
        { id: m, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
        el('rect', {
          width: W,
          height: H,
          fill: grad(
            [
              [0, 'white', 1],
              [1, 'white', 0],
            ],
            { x1: 0, x2: 0, y1: R.fade[0], y2: R.fade[1], gradientUnits: 'userSpaceOnUse' },
          ),
        }),
      );
      return `<g data-layer="event" data-part="rainbow">${el('path', { d: cur, fill: 'none', stroke: tok('rain'), 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.22 })}${el('g', { mask: `url(#${m})`, opacity: R.op }, arcs)}</g>`;
    }
    if (s.event === 'dust')
      return el('rect', {
        x: 0,
        y: 40,
        width: W,
        height: 200,
        'data-part': 'dustHaze',
        fill: grad(
          [
            [0, C.haze, 0],
            [0.45, C.haze, 0.3],
            [1, C.haze, 0.55],
          ],
          { x1: 0, y1: 0, x2: 0, y2: 1 },
        ),
      });
    return '';
  }

  function finish(): SceneSvg {
    return {
      viewBox: view.map((v) => Math.round(v)).join(' '),
      vars: B.vars,
      // line caps and joins are round everywhere: set once, inherited
      inner: `<defs>${defs}</defs><g stroke-linecap="round" stroke-linejoin="round">${out}</g>`,
      ink: inkOf(s),
      sky: key,
      body: hasBody ? { x: body[0], y: body[1], r: bodyR } : null,
    };
  }
}

/**
 * The porthole's crop of the picture (CONCEPT §6): a square round the main summit, the body at a fixed spot right of
 * it and 1.7 × its size, the largest bank (`G.banks[4]`) under it, one cloud (`G.cloudShapes[1]`) left of it, the main bolt moved inside.
 */
export const PORTHOLE = {
  view: [1200, -90, 320, 320] as const,
  body: [1440, 4] as Pt,
  bodyK: 1.7,
  bank: 4,
  cloud: [1300, 44, 1, 1] as const,
  boltDx: 70,
  deckY: 52,
  stormY: 96,
};

export interface PortholeSvg {
  viewBox: string;
  vars: Record<string, string>;
  inner: string;
  ink: 'light' | 'dark';
}

/**
 * The scene as a small round crop (overview line 28 px, widget 64 px): the same drawing (`sceneSvg`) with only sky,
 * the body in its mode, the main summit with its shaded face, one bank or cloud and a few marks of rain or snow.
 * "Schlicht" keeps sky and body. Never moves; no sky event. The round edge is the component's (`ScenePorthole`).
 */
export function portholeSvg(s: SceneState, px: number, idPrefix = 'pt'): PortholeSvg {
  const d = sceneSvg(s, {
    porthole: px,
    view: PORTHOLE.view,
    bodyAt: PORTHOLE.body,
    quietX: 0,
    idPrefix,
  });
  return { viewBox: d.viewBox, vars: d.vars, inner: d.inner, ink: d.ink };
}

/** Elements of a scene's markup (A11Y §4 counts `svg.querySelectorAll('*')`; the `<svg>` itself is the component's). */
export const countElements = (inner: string): number => (inner.match(/<[a-zA-Z]/g) ?? []).length;
