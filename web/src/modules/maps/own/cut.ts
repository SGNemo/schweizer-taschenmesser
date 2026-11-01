/**
 * Cuts map features (lon/lat) into Web Mercator vector tiles: projection on the module's own maths,
 * clipping to the tile box with a small buffer, light simplification, MVT ring orientation. Pure and
 * relative imports only, so the e2e tests can build a fixture region from Node.
 */
import { TILE_SIZE, project } from '../logic';
import {
  EXTENT,
  ringArea,
  type GeomType,
  type TileFeature,
  type TileValue,
  type VectorTile,
} from './mvt';

export interface LonLat {
  lon: number;
  lat: number;
}

export interface Bbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** A map feature in geographic coordinates, as the builder or the fixture produce it. */
export interface Feature {
  layer: string;
  type: GeomType;
  /** point: one part with the points · line: one part per linestring · polygon: exterior ring first, then holes */
  coords: LonLat[][];
  tags: Record<string, TileValue>;
  id?: number;
  /** Lowest tile zoom the feature appears in (default 0). */
  minZoom?: number;
}

export interface TileAddress {
  z: number;
  x: number;
  y: number;
}

/** Tile numbers that cover a bbox at zoom `z`. */
export function tilesCovering(bbox: Bbox, z: number): TileAddress[] {
  const a = project(bbox.maxLat, bbox.minLon, z);
  const b = project(bbox.minLat, bbox.maxLon, z);
  const n = 2 ** z;
  const x0 = Math.max(0, Math.floor(a.x / TILE_SIZE));
  const x1 = Math.min(n - 1, Math.floor(b.x / TILE_SIZE));
  const y0 = Math.max(0, Math.floor(a.y / TILE_SIZE));
  const y1 = Math.min(n - 1, Math.floor(b.y / TILE_SIZE));
  const out: TileAddress[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ z, x, y });
  return out;
}

export const tileId = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

/** Geographic bounds of a tile. */
export function tileBbox(z: number, x: number, y: number): Bbox {
  const n = 2 ** z;
  const lon = (i: number) => (i / n) * 360 - 180;
  const lat = (i: number) => {
    const t = Math.PI - (2 * Math.PI * i) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(t) - Math.exp(-t)));
  };
  return { minLon: lon(x), maxLon: lon(x + 1), maxLat: lat(y), minLat: lat(y + 1) };
}

type Pt = [number, number];

/** Tile coordinates (0..extent inside the tile) of a position. */
function toTile(p: LonLat, z: number, x: number, y: number, extent: number): Pt {
  const w = project(p.lat, p.lon, z);
  return [
    Math.round(((w.x - x * TILE_SIZE) / TILE_SIZE) * extent),
    Math.round(((w.y - y * TILE_SIZE) / TILE_SIZE) * extent),
  ];
}

/* ------------------------------------------------------------------ clipping */

interface Box {
  min: number;
  max: number;
}

/** Sutherland–Hodgman against the square box. */
function clipRing(ring: Pt[], box: Box): Pt[] {
  let out = ring;
  const edges: ((p: Pt) => number)[] = [
    (p) => p[0] - box.min, // left: keep x >= min
    (p) => box.max - p[0], // right
    (p) => p[1] - box.min, // top
    (p) => box.max - p[1], // bottom
  ];
  for (const inside of edges) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    let prev = input[input.length - 1]!;
    let prevIn = inside(prev) >= 0;
    for (const cur of input) {
      const curIn = inside(cur) >= 0;
      if (curIn !== prevIn) {
        const a = inside(prev);
        const b = inside(cur);
        const t = a / (a - b);
        out.push([
          Math.round(prev[0] + (cur[0] - prev[0]) * t),
          Math.round(prev[1] + (cur[1] - prev[1]) * t),
        ]);
      }
      if (curIn) out.push(cur);
      prev = cur;
      prevIn = curIn;
    }
  }
  return dedupe(out);
}

/** Liang–Barsky per segment: a line leaves the box as several parts. */
function clipLine(line: Pt[], box: Box): Pt[][] {
  const parts: Pt[][] = [];
  let part: Pt[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const seg = clipSegment(a, b, box);
    if (!seg) {
      if (part.length > 1) parts.push(part);
      part = [];
      continue;
    }
    const [p, q] = seg;
    const last = part[part.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) {
      if (part.length > 1) parts.push(part);
      part = [p];
    }
    part.push(q);
  }
  if (part.length > 1) parts.push(part);
  return parts.map(dedupe).filter((p) => p.length > 1);
}

function clipSegment(a: Pt, b: Pt, box: Box): [Pt, Pt] | undefined {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const checks: [number, number][] = [
    [-dx, a[0] - box.min],
    [dx, box.max - a[0]],
    [-dy, a[1] - box.min],
    [dy, box.max - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return undefined;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return undefined;
      if (r < t1) t1 = r;
    }
  }
  return [
    [Math.round(a[0] + dx * t0), Math.round(a[1] + dy * t0)],
    [Math.round(a[0] + dx * t1), Math.round(a[1] + dy * t1)],
  ];
}

function dedupe(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Douglas–Peucker: drops points closer than `tolerance` (tile units) to the line between their neighbours. */
export function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const sq = tolerance * tolerance;
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    let best = -1;
    let bestD = sq;
    const a = points[s]!;
    const b = points[e]!;
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistanceSq(points[i]!, a, b);
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([s, best], [best, e]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function segmentDistanceSq(p: Pt, a: Pt, b: Pt): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/* ------------------------------------------------------------------ cutting */

export interface CutOptions {
  extent?: number;
  /** Tile units drawn beyond the tile edge, so strokes and fills meet seamlessly. */
  buffer?: number;
  /** Simplification tolerance in tile units (0 = off). */
  tolerance?: number;
}

/** The vector tile `z/x/y` of the features, or undefined when nothing of them lies inside. */
export function cutTile(
  features: readonly Feature[],
  z: number,
  x: number,
  y: number,
  options: CutOptions = {},
): VectorTile | undefined {
  const extent = options.extent ?? EXTENT;
  const buffer = options.buffer ?? 64;
  const tolerance = options.tolerance ?? 1;
  const box: Box = { min: -buffer, max: extent + buffer };
  const layers = new Map<string, TileFeature[]>();
  for (const f of features) {
    if ((f.minZoom ?? 0) > z) continue;
    const parts = f.coords.map((part) => part.map((p) => toTile(p, z, x, y, extent)));
    let geometry: number[][][];
    if (f.type === 'point') {
      geometry = [
        parts
          .flat()
          .filter((p) => p[0] >= box.min && p[0] <= box.max && p[1] >= box.min && p[1] <= box.max),
      ];
      if (geometry[0]!.length === 0) continue;
    } else if (f.type === 'line') {
      geometry = parts.flatMap((part) => clipLine(simplify(part, tolerance), box));
      if (geometry.length === 0) continue;
    } else {
      const rings = parts.map((ring, i) => {
        let r = clipRing(simplify(ring, tolerance), box);
        if (r.length < 3) return [];
        // Exterior ring (first) clockwise on screen, holes the other way round (MVT 2.1).
        const area = ringArea(r);
        if ((i === 0 && area < 0) || (i > 0 && area > 0)) r = r.slice().reverse();
        return area === 0 ? [] : r;
      });
      if (rings[0]!.length < 3) continue;
      geometry = rings.filter((r) => r.length >= 3);
    }
    const list = layers.get(f.layer) ?? [];
    list.push({
      ...(f.id !== undefined ? { id: f.id } : {}),
      type: f.type,
      geometry,
      tags: f.tags,
    });
    layers.set(f.layer, list);
  }
  if (layers.size === 0) return undefined;
  return {
    layers: [...layers.entries()].map(([name, list]) => ({ name, extent, features: list })),
  };
}

/** Every non-empty tile of the features at the given zooms inside the bbox. */
export function cutRegion(
  features: readonly Feature[],
  bbox: Bbox,
  zooms: readonly number[],
  options: CutOptions = {},
): { z: number; x: number; y: number; tile: VectorTile }[] {
  const out: { z: number; x: number; y: number; tile: VectorTile }[] = [];
  for (const z of zooms) {
    for (const { x, y } of tilesCovering(bbox, z)) {
      const tile = cutTile(features, z, x, y, options);
      if (tile) out.push({ z, x, y, tile });
    }
  }
  return out;
}

/** Bounding box of a feature list (for a region built from them). */
export function featuresBbox(features: readonly Feature[]): Bbox {
  const b: Bbox = { minLat: 90, minLon: 180, maxLat: -90, maxLon: -180 };
  for (const f of features)
    for (const part of f.coords)
      for (const p of part) {
        b.minLat = Math.min(b.minLat, p.lat);
        b.maxLat = Math.max(b.maxLat, p.lat);
        b.minLon = Math.min(b.minLon, p.lon);
        b.maxLon = Math.max(b.maxLon, p.lon);
      }
  return b;
}
