/**
 * The CPU work of a build, as plain functions: an Overpass answer of one cell → the cell's tiles,
 * four stored tiles → their parent. The worker (`worker.ts`) and the tests call these directly; the
 * builder talks to them through `compute.ts`. Pure, relative imports only.
 */
import type { MapLevel } from '../schema';
import { cutTile, type TileAddress } from './cut';
import { decodeTile, encodeTile } from './mvt';
import { isOverloadRemark, parseOverpass, readAnswer } from './overpass';
import { buildParent, type ChildTile } from './pyramid';

export interface TileBytes {
  z: number;
  x: number;
  y: number;
  bytes: ArrayBuffer;
  /** Stored gzip (tiles copied from a region file); the renderer inflates on read. */
  gzip?: boolean;
}

export interface CellRequest {
  kind: 'cell';
  id: number;
  level: MapLevel;
  cell: TileAddress;
  /** Deepest stored zoom: the cell's tiles are cut from the cell zoom down to it. */
  maxZoom: number;
  /** The Overpass answer, still as text (parsed here, off the page). */
  json: string;
}

export interface CellResult {
  kind: 'cell';
  id: number;
  tiles: TileBytes[];
  features: number;
  /** `busy` = the server ran out of time or memory (try later), `shape` = not an Overpass answer. */
  error?: 'busy' | 'shape';
}

export interface ParentRequest {
  kind: 'parent';
  id: number;
  parent: TileAddress;
  children: TileBytes[];
}

export interface ParentResult {
  kind: 'parent';
  id: number;
  tile?: TileBytes;
}

export type BuildRequest = CellRequest | ParentRequest;
export type BuildResult = CellResult | ParentResult;

const toBuffer = (u: Uint8Array): ArrayBuffer => {
  const b = new ArrayBuffer(u.byteLength);
  new Uint8Array(b).set(u);
  return b;
};

/** The tiles under `cell` from its own zoom down to `maxZoom`. */
export function tilesUnder(cell: TileAddress, maxZoom: number): TileAddress[] {
  const out: TileAddress[] = [];
  for (let z = cell.z; z <= maxZoom; z++) {
    const dz = z - cell.z;
    const n = 2 ** dz;
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++) out.push({ z, x: cell.x * n + dx, y: cell.y * n + dy });
  }
  return out;
}

export function runCell(req: CellRequest): CellResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(req.json);
  } catch {
    return { kind: 'cell', id: req.id, tiles: [], features: 0, error: 'shape' };
  }
  let answer;
  try {
    answer = readAnswer(parsed);
  } catch {
    return { kind: 'cell', id: req.id, tiles: [], features: 0, error: 'shape' };
  }
  if (answer.elements.length === 0 && isOverloadRemark(answer.remark)) {
    return { kind: 'cell', id: req.id, tiles: [], features: 0, error: 'busy' };
  }
  const features = parseOverpass(answer);
  const tiles: TileBytes[] = [];
  for (const t of tilesUnder(req.cell, req.maxZoom)) {
    const tile = cutTile(features, t.z, t.x, t.y);
    if (tile) tiles.push({ ...t, bytes: toBuffer(encodeTile(tile)) });
  }
  return { kind: 'cell', id: req.id, tiles, features: features.length };
}

export function runParent(req: ParentRequest): ParentResult {
  const children: ChildTile[] = [];
  for (const c of req.children) {
    try {
      children.push({ z: c.z, x: c.x, y: c.y, tile: decodeTile(new Uint8Array(c.bytes)) });
    } catch {
      // An unreadable child is left out; the parent shows the rest.
    }
  }
  const tile = buildParent(req.parent.z, req.parent.x, req.parent.y, children);
  return {
    kind: 'parent',
    id: req.id,
    ...(tile ? { tile: { ...req.parent, bytes: toBuffer(encodeTile(tile)) } } : {}),
  };
}

export function handle(req: BuildRequest): BuildResult {
  return req.kind === 'cell' ? runCell(req) : runParent(req);
}

/** The buffers a result carries (to transfer instead of copy). */
export function transferables(res: BuildResult): ArrayBuffer[] {
  return res.kind === 'cell' ? res.tiles.map((t) => t.bytes) : res.tile ? [res.tile.bytes] : [];
}
