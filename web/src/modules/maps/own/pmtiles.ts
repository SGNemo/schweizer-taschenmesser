/**
 * PMTiles (version 3) without a library: one file holds a whole region of vector tiles; the app reads
 * only what it needs with HTTP range requests (header, directories, then single tiles). This is the
 * scaling path of the own map: files built by the maintainer on an own host, read by the same MVT
 * renderer. Pure and relative imports only; the tests and e2e build fixture archives with `encodePmtiles`.
 *
 * Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md (header 127 bytes, directories
 * as delta-encoded varints, tiles addressed by a Hilbert curve id).
 */
import type { Bbox } from './cut';

export const HEADER_LENGTH = 127;
/** Bytes fetched first: the header plus, for most files, the whole root directory. */
const FIRST_READ = 16_384;
const MAGIC = 'PMTiles';

export type Compression = 'none' | 'gzip' | 'unsupported';

export interface PmtilesHeader {
  rootDirOffset: number;
  rootDirLength: number;
  metadataOffset: number;
  metadataLength: number;
  leafDirOffset: number;
  leafDirLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  addressedTiles: number;
  tileEntries: number;
  tileContents: number;
  clustered: boolean;
  internalCompression: Compression;
  tileCompression: Compression;
  /** 1 = MVT (the only type the own map draws). */
  tileType: number;
  minZoom: number;
  maxZoom: number;
  bounds: Bbox;
  centerZoom: number;
  centerLon: number;
  centerLat: number;
}

export interface DirEntry {
  tileId: number;
  offset: number;
  length: number;
  /** 0 = points to a leaf directory, ≥ 1 = this many consecutive tile ids share the data. */
  runLength: number;
}

/* ------------------------------------------------------------------ tile ids (Hilbert curve) */

function rotate(n: number, xy: [number, number], rx: number, ry: number): void {
  if (ry === 0) {
    if (rx === 1) {
      xy[0] = n - 1 - xy[0];
      xy[1] = n - 1 - xy[1];
    }
    const t = xy[0];
    xy[0] = xy[1];
    xy[1] = t;
  }
}

/** The PMTiles id of a tile: all tiles of the zooms above, then the Hilbert position inside its zoom. */
export function zxyToTileId(z: number, x: number, y: number): number {
  if (z < 0 || z > 26) throw new Error('pmtiles: zoom out of range');
  const n = 2 ** z;
  if (x < 0 || y < 0 || x >= n || y >= n) throw new Error('pmtiles: tile out of range');
  let acc = 0;
  for (let i = 0; i < z; i++) acc += 4 ** i;
  const xy: [number, number] = [x, y];
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (xy[0] & s) > 0 ? 1 : 0;
    const ry = (xy[1] & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    rotate(s, xy, rx, ry);
  }
  return acc + d;
}

/* ------------------------------------------------------------------ header */

const compressionOf = (code: number): Compression =>
  code === 1 ? 'none' : code === 2 ? 'gzip' : 'unsupported';

/** Throws when the bytes are not a PMTiles v3 header. */
export function parseHeader(bytes: Uint8Array): PmtilesHeader {
  if (bytes.byteLength < HEADER_LENGTH) throw new Error('pmtiles: header too short');
  const magic = new TextDecoder().decode(bytes.subarray(0, 7));
  if (magic !== MAGIC) throw new Error('pmtiles: not a PMTiles file');
  if (bytes[7] !== 3) throw new Error(`pmtiles: version ${bytes[7]} is not supported`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_LENGTH);
  const u64 = (at: number) => Number(view.getBigUint64(at, true));
  const e7 = (at: number) => view.getInt32(at, true) / 1e7;
  return {
    rootDirOffset: u64(8),
    rootDirLength: u64(16),
    metadataOffset: u64(24),
    metadataLength: u64(32),
    leafDirOffset: u64(40),
    leafDirLength: u64(48),
    tileDataOffset: u64(56),
    tileDataLength: u64(64),
    addressedTiles: u64(72),
    tileEntries: u64(80),
    tileContents: u64(88),
    clustered: view.getUint8(96) === 1,
    internalCompression: compressionOf(view.getUint8(97)),
    tileCompression: compressionOf(view.getUint8(98)),
    tileType: view.getUint8(99),
    minZoom: view.getUint8(100),
    maxZoom: view.getUint8(101),
    bounds: { minLon: e7(102), minLat: e7(106), maxLon: e7(110), maxLat: e7(114) },
    centerZoom: view.getUint8(118),
    centerLon: e7(119),
    centerLat: e7(123),
  };
}

/* ------------------------------------------------------------------ directories */

class Varints {
  pos = 0;
  constructor(readonly bytes: Uint8Array) {}
  next(): number {
    let result = 0;
    let factor = 1;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.bytes.length) throw new Error('pmtiles: truncated directory');
      const b = this.bytes[this.pos++]!;
      result += (b & 0x7f) * factor;
      if (b < 0x80) return result;
      factor *= 0x80;
    }
    throw new Error('pmtiles: varint too long');
  }
}

/** A (decompressed) directory: ids as deltas, then run lengths, lengths and offsets (0 = contiguous). */
export function decodeDirectory(bytes: Uint8Array): DirEntry[] {
  const v = new Varints(bytes);
  const n = v.next();
  const entries: DirEntry[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    last += v.next();
    entries.push({ tileId: last, offset: 0, length: 0, runLength: 0 });
  }
  for (let i = 0; i < n; i++) entries[i]!.runLength = v.next();
  for (let i = 0; i < n; i++) entries[i]!.length = v.next();
  for (let i = 0; i < n; i++) {
    const o = v.next();
    entries[i]!.offset = o === 0 && i > 0 ? entries[i - 1]!.offset + entries[i - 1]!.length : o - 1;
  }
  return entries;
}

/** The entry that holds `tileId` (a tile, or a leaf directory to look into), or undefined. */
export function findEntry(entries: readonly DirEntry[], tileId: number): DirEntry | undefined {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid]!.tileId > tileId) hi = mid - 1;
    else lo = mid + 1;
  }
  if (hi < 0) return undefined;
  const e = entries[hi]!;
  if (e.runLength === 0) return e;
  return tileId < e.tileId + e.runLength ? e : undefined;
}

/* ------------------------------------------------------------------ reading a file */

export interface PmtilesMetadata {
  name?: string;
  attribution?: string;
  description?: string;
}

export interface PmtilesTile {
  bytes: ArrayBuffer;
  gzip: boolean;
}

export interface Pmtiles {
  url: string;
  header: PmtilesHeader;
  metadata: PmtilesMetadata;
  /** The tile's bytes as stored (gzip when the file compresses tiles), undefined when the file has none. */
  getTile(z: number, x: number, y: number): Promise<PmtilesTile | undefined>;
  /** Whether the file's bounds contain the point. */
  covers(p: { lat: number; lon: number }): boolean;
}

export interface OpenOptions {
  fetch: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') throw new Error('pmtiles: no inflate');
  const body = new Response(bytes).body;
  if (!body) throw new Error('pmtiles: no inflate');
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

/** Reads `[offset, offset + length)` of the file with one range request. */
async function readRange(
  url: string,
  offset: number,
  length: number,
  options: OpenOptions,
): Promise<ArrayBuffer> {
  const res = await options.fetch(url, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}`, ...options.headers },
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  if (res.status === 206) return res.arrayBuffer();
  if (res.status === 200) {
    // A host that ignores ranges sends the whole file: take the slice.
    const all = await res.arrayBuffer();
    return all.slice(offset, offset + length);
  }
  throw new Error(`pmtiles: http ${res.status}`);
}

/** Text of an attribution that may carry HTML links, as plain text. */
export const plainAttribution = (html: string | undefined): string | undefined =>
  html
    ? html
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || undefined
    : undefined;

/** Opens a file: header, root directory and metadata with as few requests as possible. */
export async function openPmtiles(url: string, options: OpenOptions): Promise<Pmtiles> {
  const first = new Uint8Array(await readRange(url, 0, FIRST_READ, options));
  const header = parseHeader(first);
  if (header.tileType !== 1) throw new Error('pmtiles: not a vector tile file');
  if (header.internalCompression === 'unsupported' || header.tileCompression === 'unsupported')
    throw new Error('pmtiles: unsupported compression');

  const inflate = async (bytes: ArrayBuffer, compression: Compression): Promise<Uint8Array> =>
    new Uint8Array(compression === 'gzip' ? await gunzip(bytes) : bytes);

  async function section(offset: number, length: number): Promise<ArrayBuffer> {
    if (offset + length <= first.byteLength) return first.slice(offset, offset + length).buffer;
    return readRange(url, offset, length, options);
  }

  const root = decodeDirectory(
    await inflate(
      await section(header.rootDirOffset, header.rootDirLength),
      header.internalCompression,
    ),
  );
  let metadata: PmtilesMetadata = {};
  if (header.metadataLength > 0) {
    try {
      const text = new TextDecoder().decode(
        await inflate(
          await section(header.metadataOffset, header.metadataLength),
          header.internalCompression,
        ),
      );
      const parsed = JSON.parse(text) as Record<string, unknown>;
      metadata = {
        ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
        ...(typeof parsed.attribution === 'string' ? { attribution: parsed.attribution } : {}),
        ...(typeof parsed.description === 'string' ? { description: parsed.description } : {}),
      };
    } catch {
      // Metadata is optional: a broken one costs nothing but the credit line.
    }
  }

  const leaves = new Map<number, DirEntry[]>();
  async function leaf(entry: DirEntry): Promise<DirEntry[]> {
    const hit = leaves.get(entry.offset);
    if (hit) return hit;
    const bytes = await readRange(url, header.leafDirOffset + entry.offset, entry.length, options);
    const dir = decodeDirectory(await inflate(bytes, header.internalCompression));
    leaves.set(entry.offset, dir);
    return dir;
  }

  return {
    url,
    header,
    metadata,
    async getTile(z, x, y) {
      if (z < header.minZoom || z > header.maxZoom) return undefined;
      const id = zxyToTileId(z, x, y);
      let entry = findEntry(root, id);
      if (entry && entry.runLength === 0) entry = findEntry(await leaf(entry), id);
      if (!entry || entry.runLength === 0 || entry.length === 0) return undefined;
      const bytes = await readRange(
        url,
        header.tileDataOffset + entry.offset,
        entry.length,
        options,
      );
      return { bytes, gzip: header.tileCompression === 'gzip' };
    },
    covers(p) {
      const b = header.bounds;
      return p.lat >= b.minLat && p.lat <= b.maxLat && p.lon >= b.minLon && p.lon <= b.maxLon;
    },
  };
}

/* ------------------------------------------------------------------ writing (fixtures, tests) */

export interface PmtilesInput {
  tiles: { z: number; x: number; y: number; bytes: Uint8Array }[];
  bounds: Bbox;
  minZoom: number;
  maxZoom: number;
  /** Whether `bytes` are gzip already (the header says so; nothing is compressed here). */
  gzip?: boolean;
  metadata?: PmtilesMetadata;
  center?: { lat: number; lon: number; zoom: number };
  /** Entries per leaf directory; unset = every entry in the root directory, no leaves. */
  leafSize?: number;
}

function varint(n: number, out: number[]): void {
  let v = n;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

function encodeDirectory(entries: readonly DirEntry[]): number[] {
  const dir: number[] = [];
  varint(entries.length, dir);
  let last = 0;
  for (const e of entries) {
    varint(e.tileId - last, dir);
    last = e.tileId;
  }
  for (const e of entries) varint(e.runLength, dir);
  for (const e of entries) varint(e.length, dir);
  for (const e of entries) varint(e.offset + 1, dir);
  return dir;
}

/**
 * A minimal v3 archive with uncompressed directories: one entry per tile, tiles in id order, leaf
 * directories only with `leafSize`. Enough for a fixture; real files come from Planetiler or `pmtiles`.
 */
export function encodePmtiles(input: PmtilesInput): Uint8Array {
  const sorted = input.tiles
    .map((t) => ({ ...t, id: zxyToTileId(t.z, t.x, t.y) }))
    .sort((a, b) => a.id - b.id);
  const data: number[] = [];
  const entries: DirEntry[] = [];
  for (const t of sorted) {
    entries.push({ tileId: t.id, offset: data.length, length: t.bytes.length, runLength: 1 });
    for (const b of t.bytes) data.push(b);
  }
  const leaves: number[] = [];
  let dir: number[];
  if (input.leafSize && input.leafSize > 0) {
    const root: DirEntry[] = [];
    for (let i = 0; i < entries.length; i += input.leafSize) {
      const chunk = entries.slice(i, i + input.leafSize);
      const bytes = encodeDirectory(chunk);
      root.push({
        tileId: chunk[0]!.tileId,
        offset: leaves.length,
        length: bytes.length,
        runLength: 0,
      });
      for (const b of bytes) leaves.push(b);
    }
    dir = encodeDirectory(root);
  } else {
    dir = encodeDirectory(entries);
  }
  const meta = new TextEncoder().encode(JSON.stringify(input.metadata ?? {}));

  const rootDirOffset = HEADER_LENGTH;
  const metadataOffset = rootDirOffset + dir.length;
  const leafDirOffset = metadataOffset + meta.length;
  const tileDataOffset = leafDirOffset + leaves.length;
  const out = new Uint8Array(tileDataOffset + data.length);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(MAGIC), 0);
  out[7] = 3;
  const u64 = (at: number, n: number) => view.setBigUint64(at, BigInt(n), true);
  const e7 = (at: number, n: number) => view.setInt32(at, Math.round(n * 1e7), true);
  u64(8, rootDirOffset);
  u64(16, dir.length);
  u64(24, metadataOffset);
  u64(32, meta.length);
  u64(40, leafDirOffset);
  u64(48, leaves.length);
  u64(56, tileDataOffset);
  u64(64, data.length);
  u64(72, entries.length);
  u64(80, entries.length);
  u64(88, entries.length);
  out[96] = 1;
  out[97] = 1;
  out[98] = input.gzip ? 2 : 1;
  out[99] = 1;
  out[100] = input.minZoom;
  out[101] = input.maxZoom;
  e7(102, input.bounds.minLon);
  e7(106, input.bounds.minLat);
  e7(110, input.bounds.maxLon);
  e7(114, input.bounds.maxLat);
  const c = input.center ?? {
    zoom: input.minZoom,
    lon: (input.bounds.minLon + input.bounds.maxLon) / 2,
    lat: (input.bounds.minLat + input.bounds.maxLat) / 2,
  };
  out[118] = c.zoom;
  e7(119, c.lon);
  e7(123, c.lat);
  out.set(dir, rootDirOffset);
  out.set(meta, metadataOffset);
  out.set(leaves, leafDirOffset);
  out.set(data, tileDataOffset);
  return out;
}
