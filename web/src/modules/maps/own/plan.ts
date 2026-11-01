/**
 * The build plan of an own-map region: which Web Mercator cells are fetched (one request each), which
 * tile zooms are stored, and how a too-large area is cut down to a calm first piece around its centre.
 * Pure; the cell order is deterministic, so a build resumes from `cells.done`.
 */
import { TILE_SIZE, project } from '../logic';
import type { MapLevel } from '../schema';
import { tileBbox, tilesCovering, type Bbox, type LonLat, type TileAddress } from './cut';

/** One request per cell: z13 (≈ 3 km at 50° N) for the lean map, z14 for the full one. */
export const CELL_ZOOM: Record<MapLevel, number> = { lean: 13, full: 14 };
/** Stored tile zooms per level; deeper views are drawn from the stored data (overzoom). */
export const STORED_ZOOMS: Record<MapLevel, { min: number; max: number }> = {
  lean: { min: 8, max: 14 },
  full: { min: 8, max: 16 },
};
/** More cells than this and the area is cut down around its centre (≈ 640 km² at z13). */
export const MAX_CELLS = 64;
/** Features are fetched a little beyond each cell so lines and areas meet at the cell edges. */
const CELL_MARGIN = 1 / 32;

export interface BuildPlan {
  cellZoom: number;
  zooms: { min: number; max: number };
  cells: TileAddress[];
}

export function planRegion(level: MapLevel, bbox: Bbox): BuildPlan {
  const cellZoom = CELL_ZOOM[level];
  return { cellZoom, zooms: STORED_ZOOMS[level], cells: tilesCovering(bbox, cellZoom) };
}

/** The bbox a cell's request asks for: the tile plus a small margin. */
export function cellBbox(cell: TileAddress): Bbox {
  const b = tileBbox(cell.z, cell.x, cell.y);
  const dLat = (b.maxLat - b.minLat) * CELL_MARGIN;
  const dLon = (b.maxLon - b.minLon) * CELL_MARGIN;
  return {
    minLat: b.minLat - dLat,
    maxLat: b.maxLat + dLat,
    minLon: b.minLon - dLon,
    maxLon: b.maxLon + dLon,
  };
}

/**
 * A bbox with at most `maxCells` cells at the level's cell zoom: the given one when it fits, else a
 * square around `centre` of that size (the first piece of a large area; the rest can be added later).
 */
export function capBbox(
  bbox: Bbox,
  centre: LonLat,
  level: MapLevel,
  maxCells = MAX_CELLS,
): { bbox: Bbox; capped: boolean } {
  const z = CELL_ZOOM[level];
  if (tilesCovering(bbox, z).length <= maxCells) return { bbox, capped: false };
  // A square of whole cells around the centre cell (so the count is exact), inside the given bbox.
  const side = Math.max(1, Math.floor(Math.sqrt(maxCells)));
  const c = project(centre.lat, centre.lon, z);
  const tx = Math.floor(c.x / TILE_SIZE);
  const ty = Math.floor(c.y / TILE_SIZE);
  const before = Math.floor((side - 1) / 2);
  const after = side - 1 - before;
  const first = tileBbox(z, tx - before, ty - before);
  const last = tileBbox(z, tx + after, ty + after);
  const eps = 1e-9;
  return {
    bbox: {
      minLat: Math.max(bbox.minLat, last.minLat + eps),
      maxLat: Math.min(bbox.maxLat, first.maxLat - eps),
      minLon: Math.max(bbox.minLon, first.minLon + eps),
      maxLon: Math.min(bbox.maxLon, last.maxLon - eps),
    },
    capped: true,
  };
}

/** "Schlossplatz, Erlangen, Bayern, Deutschland" → "Schlossplatz"; coordinates stay whole. */
export function regionName(label: string): string {
  const first = label.split(',')[0]!.trim();
  return (first || label).slice(0, 80);
}
