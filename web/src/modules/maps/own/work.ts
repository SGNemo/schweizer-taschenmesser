/**
 * The CPU work of a build, as plain functions: an Overpass answer of one block → the tiles and names
 * of its cells, four stored tiles → their parent, stored tiles → their names. The worker (`worker.ts`) and
 * the tests call these directly; the builder talks to them through `compute.ts`. Pure, relative
 * imports only.
 */
import type { MapLevel } from '../schema';
import { cutTile, type TileAddress } from './cut';
import { decodeTile, encodeTile } from './mvt';
import { dedupe, namesInTile, type NameEntry } from './names';
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

export interface BlockRequest {
  kind: 'block';
  id: number;
  level: MapLevel;
  /** The cells the answer covers (up to four, one parent tile). */
  cells: TileAddress[];
  /** Deepest stored zoom: a cell's tiles are cut from the cell zoom down to it. */
  maxZoom: number;
  /** The Overpass answer, still as text (parsed here, off the page). */
  json: string;
}

export interface CellTiles {
  cell: TileAddress;
  tiles: TileBytes[];
  /** What the cell knows by name (from its deepest tiles). */
  names: NameEntry[];
}

export interface BlockResult {
  kind: 'block';
  id: number;
  cells: CellTiles[];
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

/** The names of stored tiles (copied from a region file, or built before the index existed). */
export interface NamesRequest {
  kind: 'names';
  id: number;
  /** Plain MVT bytes (inflated by the caller when stored gzip). */
  tiles: TileBytes[];
}

export interface NamesResult {
  kind: 'names';
  id: number;
  names: NameEntry[];
}

export type BuildRequest = BlockRequest | ParentRequest | NamesRequest;
export type BuildResult = BlockResult | ParentResult | NamesResult;

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

export function runBlock(req: BlockRequest): BlockResult {
  const failed = (error: 'busy' | 'shape'): BlockResult => ({
    kind: 'block',
    id: req.id,
    cells: [],
    features: 0,
    error,
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(req.json);
  } catch {
    return failed('shape');
  }
  let answer;
  try {
    answer = readAnswer(parsed);
  } catch {
    return failed('shape');
  }
  // A timed-out or out-of-memory answer is incomplete even when it carries some elements.
  if (isOverloadRemark(answer.remark)) return failed('busy');
  const features = parseOverpass(answer);
  const cells: CellTiles[] = req.cells.map((cell) => {
    const tiles: TileBytes[] = [];
    const names: NameEntry[] = [];
    for (const t of tilesUnder(cell, req.maxZoom)) {
      const tile = cutTile(features, t.z, t.x, t.y);
      if (!tile) continue;
      tiles.push({ ...t, bytes: toBuffer(encodeTile(tile)) });
      if (t.z === req.maxZoom) names.push(...namesInTile(tile, t.z, t.x, t.y));
    }
    return { cell, tiles, names: dedupe(names) };
  });
  return { kind: 'block', id: req.id, cells, features: features.length };
}

export function runNames(req: NamesRequest): NamesResult {
  const names: NameEntry[] = [];
  for (const t of req.tiles) {
    try {
      names.push(...namesInTile(decodeTile(new Uint8Array(t.bytes)), t.z, t.x, t.y));
    } catch {
      // An unreadable tile has no names to offer.
    }
  }
  return { kind: 'names', id: req.id, names: dedupe(names) };
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
  switch (req.kind) {
    case 'block':
      return runBlock(req);
    case 'parent':
      return runParent(req);
    case 'names':
      return runNames(req);
  }
}

/** The buffers a result carries (to transfer instead of copy). */
export function transferables(res: BuildResult): ArrayBuffer[] {
  switch (res.kind) {
    case 'block':
      return res.cells.flatMap((c) => c.tiles.map((t) => t.bytes));
    case 'parent':
      return res.tile ? [res.tile.bytes] : [];
    case 'names':
      return [];
  }
}
