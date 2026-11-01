/**
 * What the own map knows by name: places, streets, waters, POIs and named areas, read from the deepest
 * stored tiles of a cell when it is written. The search field answers from this index before any
 * request leaves the device. Pure, relative imports only (the worker and the tests use it).
 */
import { TILE_SIZE, unproject } from '../logic';
import { EXTENT, type TileFeature, type VectorTile } from './mvt';

export const NAME_KINDS = ['place', 'street', 'water', 'poi', 'area', 'other'] as const;
export type NameKind = (typeof NAME_KINDS)[number];

export interface NameEntry {
  name: string;
  kind: NameKind;
  lat: number;
  lon: number;
}

/** The kind of a named feature, by the layer the cutter put it in. */
export function kindOf(layer: string): NameKind {
  switch (layer) {
    case 'place':
      return 'place';
    case 'road':
      return 'street';
    case 'water':
    case 'waterway':
      return 'water';
    case 'poi':
    case 'building': // a named building is a venue: a town hall, a station
      return 'poi';
    case 'landuse':
      return 'area';
    default:
      return 'other';
  }
}

/** Lower case, accents folded (ß → ss), one space between words: what the index and a query share. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words of a name, normalised and unique (the multi-entry index of the names table). */
export function tokensOf(s: string): string[] {
  const n = normalize(s);
  return n ? [...new Set(n.split(' '))] : [];
}

/**
 * A representative point of a feature in tile units: the point itself, the middle vertex of the
 * longest part of a line (a street is cut into pieces at the tile edge), the mean of a polygon's
 * outer ring.
 */
export function anchorOf(f: TileFeature): [number, number] | undefined {
  const first = f.geometry[0];
  if (!first || first.length === 0) return undefined;
  if (f.type === 'point') return [first[0]![0]!, first[0]![1]!];
  if (f.type === 'line') {
    let best = first;
    for (const part of f.geometry) if (part.length > best.length) best = part;
    const mid = best[Math.floor(best.length / 2)]!;
    return [mid[0]!, mid[1]!];
  }
  let sx = 0;
  let sy = 0;
  for (const p of first) {
    sx += p[0]!;
    sy += p[1]!;
  }
  return [sx / first.length, sy / first.length];
}

const round = (n: number): number => Math.round(n * 1e5) / 1e5;

/** The named features of one tile with a position each, one entry per kind and name. */
export function namesInTile(tile: VectorTile, z: number, x: number, y: number): NameEntry[] {
  const out: NameEntry[] = [];
  for (const layer of tile.layers) {
    const kind = kindOf(layer.name);
    const extent = layer.extent ?? EXTENT;
    for (const f of layer.features) {
      const name = f.tags.name;
      if (typeof name !== 'string' || name.trim() === '') continue;
      const a = anchorOf(f);
      if (!a) continue;
      // A buffered geometry may anchor just outside the tile: keep the point inside it.
      const gx = Math.min(extent, Math.max(0, a[0]));
      const gy = Math.min(extent, Math.max(0, a[1]));
      const p = unproject((x + gx / extent) * TILE_SIZE, (y + gy / extent) * TILE_SIZE, z);
      out.push({ name: name.trim(), kind, lat: round(p.lat), lon: round(p.lon) });
    }
  }
  return dedupe(out);
}

/** One entry per kind and normalised name; the first stays. */
export function dedupe(entries: readonly NameEntry[]): NameEntry[] {
  const seen = new Set<string>();
  const out: NameEntry[] = [];
  for (const e of entries) {
    const key = `${e.kind}|${normalize(e.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
