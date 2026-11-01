/**
 * "Nemostadt": an invented small town as a fixture region of the own map, used by unit tests, the e2e
 * tests (imported from Node: relative imports, no DOM) and nothing in the shipped app. Streets, names
 * and shapes are made up; the town sits on the seed's coordinates so the seed places fall onto it.
 */
import { cutRegion, featuresBbox, type Feature, type LonLat } from './cut';
import { encodeTile } from './mvt';
import type { Region, Tile } from '../schema';

export const SAMPLE_REGION_ID = 'sample-nemostadt';
export const SAMPLE_CENTER: LonLat = { lat: 49.5981, lon: 11.0044 };
export const SAMPLE_ZOOMS = [12, 13, 14, 15, 16] as const;

const M_LAT = 1 / 111_320;
const M_LON = 1 / (111_320 * Math.cos((SAMPLE_CENTER.lat * Math.PI) / 180));

/** Position `east` metres east and `north` metres north of the centre. */
const at = (east: number, north: number): LonLat => ({
  lon: SAMPLE_CENTER.lon + east * M_LON,
  lat: SAMPLE_CENTER.lat + north * M_LAT,
});

const rect = (x0: number, y0: number, x1: number, y1: number): LonLat[] => [
  at(x0, y0),
  at(x1, y0),
  at(x1, y1),
  at(x0, y1),
  at(x0, y0),
];

const line = (...pts: [number, number][]): LonLat[] => pts.map(([e, n]) => at(e, n));

/** A band of `width` metres around a centreline (offsets north/south only: the rivers here run west–east). */
function band(centre: [number, number][], width: number): LonLat[] {
  const half = width / 2;
  const left = centre.map(([e, n]) => at(e, n + half));
  const right = centre.map(([e, n]) => at(e, n - half)).reverse();
  return [...left, ...right, left[0]!];
}

function circle(cx: number, cy: number, r: number, n = 12): LonLat[] {
  const pts: LonLat[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(at(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

const RIVER: [number, number][] = [
  [-1700, 300],
  [-900, 250],
  [-200, 400],
  [500, 350],
  [1200, 500],
  [1700, 450],
];

const STREETS: { name: string; cls: string; pts: [number, number][] }[] = [
  {
    name: 'Hauptstraße',
    cls: 'primary',
    pts: [
      [-1600, 0],
      [1600, 0],
    ],
  },
  {
    name: 'Bahnhofstraße',
    cls: 'secondary',
    pts: [
      [0, -1100],
      [0, 1100],
    ],
  },
  {
    name: 'Ringstraße',
    cls: 'tertiary',
    pts: [
      [-1300, -900],
      [1300, -900],
      [1300, 900],
      [-1300, 900],
      [-1300, -900],
    ],
  },
  {
    name: 'Amselweg',
    cls: 'residential',
    pts: [
      [300, -900],
      [300, -100],
    ],
  },
  {
    name: 'Birkenweg',
    cls: 'residential',
    pts: [
      [500, -900],
      [500, -100],
    ],
  },
  {
    name: 'Drosselgasse',
    cls: 'residential',
    pts: [
      [100, -400],
      [800, -400],
    ],
  },
  {
    name: 'Eichenstraße',
    cls: 'residential',
    pts: [
      [100, -700],
      [800, -700],
    ],
  },
  {
    name: 'Finkenweg',
    cls: 'residential',
    pts: [
      [-1300, -900],
      [-1300, -100],
    ],
  },
  {
    name: 'Ginsterweg',
    cls: 'residential',
    pts: [
      [-1000, -900],
      [-1000, -100],
    ],
  },
  {
    name: 'Hollerweg',
    cls: 'residential',
    pts: [
      [-1500, -500],
      [-800, -500],
    ],
  },
  {
    name: 'Parkweg',
    cls: 'path',
    pts: [
      [-700, -200],
      [-400, 0],
      [-100, 120],
    ],
  },
  { name: 'Uferradweg', cls: 'cycleway', pts: RIVER.map(([e, n]) => [e, n - 60]) },
  {
    name: '',
    cls: 'service',
    pts: [
      [1000, 200],
      [1000, 450],
    ],
  },
  {
    name: '',
    cls: 'steps',
    pts: [
      [-150, 150],
      [-150, 220],
    ],
  },
];

const STREET_X = new Set([300, 500, -1300, -1000]);
const STREET_Y = new Set([-400, -700, -500]);

/** Small houses along the residential streets, skipping the streets themselves. Deterministic. */
function houses(): Feature[] {
  const out: Feature[] = [];
  const blocks: [number, number, number, number][] = [
    [120, -980, 800, -120],
    [-1480, -980, -820, -120],
  ];
  let id = 1000;
  for (const [x0, y0, x1, y1] of blocks) {
    for (let x = x0; x < x1; x += 110) {
      for (let y = y0; y < y1; y += 115) {
        const onStreet =
          [...STREET_X].some((sx) => Math.abs(sx - x) < 40 || Math.abs(sx - (x + 26)) < 40) ||
          [...STREET_Y].some((sy) => Math.abs(sy - y) < 30 || Math.abs(sy - (y + 18)) < 30);
        if (onStreet) continue;
        out.push({
          layer: 'building',
          type: 'polygon',
          coords: [rect(x, y, x + 26, y + 18)],
          tags: { class: 'house' },
          id: id++,
          minZoom: 14,
        });
      }
    }
  }
  return out;
}

export function sampleFeatures(): Feature[] {
  const landuse = (cls: string, coords: LonLat[], minZoom: number): Feature => ({
    layer: 'landuse',
    type: 'polygon',
    coords: [coords],
    tags: { class: cls },
    minZoom,
  });
  const poi = (name: string, cls: string, e: number, n: number): Feature => ({
    layer: 'poi',
    type: 'point',
    coords: [[at(e, n)]],
    tags: { class: cls, name },
    minZoom: 15,
  });
  return [
    landuse('residential', rect(-1500, -1000, -800, -100), 11),
    landuse('residential', rect(100, -1000, 800, -100), 11),
    landuse('industrial', rect(-1500, 500, -1000, 1000), 11),
    landuse('forest', rect(900, 600, 1600, 1100), 8),
    landuse('park', rect(-700, -300, -100, 150), 11),
    {
      layer: 'water',
      type: 'polygon',
      coords: [band(RIVER, 70)],
      tags: { class: 'river', name: 'Flosse' },
    },
    { layer: 'water', type: 'polygon', coords: [circle(900, -600, 120)], tags: { class: 'lake' } },
    {
      layer: 'waterway',
      type: 'line',
      coords: [line(...RIVER)],
      tags: { class: 'river', name: 'Flosse' },
      minZoom: 9,
    },
    ...STREETS.map((s, i): Feature => ({
      layer: 'road',
      type: 'line',
      coords: [line(...s.pts)],
      tags: s.name ? { class: s.cls, name: s.name } : { class: s.cls },
      id: 100 + i,
    })),
    {
      layer: 'rail',
      type: 'line',
      coords: [line([-1600, -1050], [-600, -700], [0, -650], [600, -700], [1600, -1050])],
      tags: { class: 'rail' },
      minZoom: 10,
    },
    ...houses(),
    {
      layer: 'building',
      type: 'polygon',
      coords: [rect(-100, -100, -40, -50)],
      tags: { class: 'civic', name: 'Rathaus' },
      minZoom: 14,
    },
    {
      layer: 'building',
      type: 'polygon',
      coords: [rect(-30, -660, 30, -630)],
      tags: { class: 'transport', name: 'Bahnhof' },
      minZoom: 14,
    },
    {
      layer: 'place',
      type: 'point',
      coords: [[at(0, -150)]],
      tags: { class: 'town', name: 'Nemostadt' },
      minZoom: 8,
    },
    {
      layer: 'place',
      type: 'point',
      coords: [[at(0, 800)]],
      tags: { class: 'suburb', name: 'Nordstadt' },
      minZoom: 12,
    },
    {
      layer: 'place',
      type: 'point',
      coords: [[at(-1100, -800)]],
      tags: { class: 'suburb', name: 'Weststadt' },
      minZoom: 12,
    },
    poi('Bahnhof', 'transport', 0, -610),
    poi('Wochenmarkt', 'shop', 150, 60),
    poi('Apotheke', 'health', -120, -60),
    poi('Schule', 'education', 600, -500),
    poi('Café Flosse', 'food', -400, 80),
  ];
}

export interface SampleRegion {
  id: string;
  region: Region;
  tiles: { id: string; data: Tile }[];
}

/** The fixture region: tiles of Nemostadt at zoom 12–16 as MVT (not compressed) plus its region row. */
export function sampleRegion(): SampleRegion {
  const features = sampleFeatures();
  const bbox = featuresBbox(features);
  const cut = cutRegion(features, bbox, SAMPLE_ZOOMS);
  const tiles = cut.map(({ z, x, y, tile }) => {
    const bytes = encodeTile(tile);
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return {
      id: `${z}/${x}/${y}`,
      data: {
        regionId: SAMPLE_REGION_ID,
        z,
        x,
        y,
        bytes: copy,
        gzip: false,
        size: bytes.byteLength,
      },
    };
  });
  return {
    id: SAMPLE_REGION_ID,
    region: {
      name: 'Nemostadt (Beispiel)',
      bbox,
      level: 'full',
      zooms: { min: SAMPLE_ZOOMS[0], max: SAMPLE_ZOOMS[SAMPLE_ZOOMS.length - 1]! },
      cells: { done: tiles.length, total: tiles.length },
      status: 'done',
      bytes: tiles.reduce((n, t) => n + t.data.size, 0),
      source: 'sample',
    },
    tiles,
  };
}
