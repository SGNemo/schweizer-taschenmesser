/**
 * Mapbox Vector Tiles (MVT 2.1) without a library: a small protobuf writer and reader for the tiles the
 * own map stores. Pure TypeScript, relative imports only (the e2e tests import it from Node as well).
 *
 * Why MVT: MapLibre, PMTiles files from Planetiler and our own renderer all read this one format, so the
 * stored data stays useful whichever way the drawing goes (docs/features/map-own.md §3).
 */

export const EXTENT = 4096;
export const MVT_VERSION = 2;

export type TileValue = string | number | boolean;
export type GeomType = 'point' | 'line' | 'polygon';

export interface TileFeature {
  id?: number;
  type: GeomType;
  /**
   * Tile coordinates (integers, 0..extent inside the tile, a little beyond for the buffer).
   * point: one part with all points · line: one part per linestring · polygon: one part per ring
   * (exterior first, positive area = clockwise on screen; holes negative).
   */
  geometry: number[][][];
  tags: Record<string, TileValue>;
}

export interface TileLayer {
  name: string;
  extent?: number;
  features: TileFeature[];
}

export interface VectorTile {
  layers: TileLayer[];
}

/* ------------------------------------------------------------------ protobuf primitives */

const GEOM_CODE: Record<GeomType, number> = { point: 1, line: 2, polygon: 3 };
const GEOM_TYPE: Record<number, GeomType> = { 1: 'point', 2: 'line', 3: 'polygon' };
const MOVE_TO = 1;
const LINE_TO = 2;
const CLOSE_PATH = 7;

class Writer {
  private buf = new Uint8Array(1024);
  private len = 0;

  private grow(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  varint(n: number): void {
    // Numbers up to 2^53: split with division, never with 32-bit shifts.
    this.grow(10);
    let v = n;
    while (v >= 0x80) {
      this.buf[this.len++] = (v % 0x80) | 0x80;
      v = Math.floor(v / 0x80);
    }
    this.buf[this.len++] = v;
  }

  /** Field key: number and wire type. */
  key(field: number, wire: number): void {
    this.varint(field * 8 + wire);
  }

  bytes(field: number, data: Uint8Array): void {
    this.key(field, 2);
    this.varint(data.length);
    this.grow(data.length);
    this.buf.set(data, this.len);
    this.len += data.length;
  }

  string(field: number, s: string): void {
    this.bytes(field, new TextEncoder().encode(s));
  }

  uint(field: number, n: number): void {
    this.key(field, 0);
    this.varint(n);
  }

  double(field: number, n: number): void {
    this.key(field, 1);
    this.grow(8);
    new DataView(this.buf.buffer, this.len, 8).setFloat64(0, n, true);
    this.len += 8;
  }

  packed(field: number, values: number[]): void {
    const w = new Writer();
    for (const v of values) w.varint(v);
    this.bytes(field, w.result());
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

export const zigzag = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1);
export const unzigzag = (n: number): number => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

/* ------------------------------------------------------------------ encoding */

function encodeValue(v: TileValue): Uint8Array {
  const w = new Writer();
  if (typeof v === 'string') w.string(1, v);
  else if (typeof v === 'boolean') w.uint(7, v ? 1 : 0);
  else if (Number.isInteger(v)) w.uint(6, zigzag(v));
  else w.double(3, v);
  return w.result();
}

/** Geometry commands with a cursor that carries over between parts (the spec's "cursor"). */
function encodeGeometry(type: GeomType, parts: number[][][]): number[] {
  const out: number[] = [];
  let cx = 0;
  let cy = 0;
  const push = (p: number[]) => {
    out.push(zigzag(p[0]! - cx), zigzag(p[1]! - cy));
    cx = p[0]!;
    cy = p[1]!;
  };
  if (type === 'point') {
    const points = parts.flat();
    if (points.length === 0) return out;
    out.push((points.length << 3) | MOVE_TO);
    for (const p of points) push(p);
    return out;
  }
  for (const part of parts) {
    let pts = part;
    if (type === 'polygon' && pts.length > 1) {
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      if (first[0] === last[0] && first[1] === last[1]) pts = pts.slice(0, -1);
    }
    if (pts.length < (type === 'polygon' ? 3 : 2)) continue;
    out.push((1 << 3) | MOVE_TO);
    push(pts[0]!);
    out.push(((pts.length - 1) << 3) | LINE_TO);
    for (let i = 1; i < pts.length; i++) push(pts[i]!);
    if (type === 'polygon') out.push((1 << 3) | CLOSE_PATH);
  }
  return out;
}

function encodeLayer(layer: TileLayer): Uint8Array {
  const w = new Writer();
  w.uint(15, MVT_VERSION);
  w.string(1, layer.name);
  const keys: string[] = [];
  const keyIndex = new Map<string, number>();
  const values: Uint8Array[] = [];
  const valueIndex = new Map<string, number>();
  for (const f of layer.features) {
    const fw = new Writer();
    if (f.id !== undefined) fw.uint(1, f.id);
    const tags: number[] = [];
    for (const [k, v] of Object.entries(f.tags)) {
      let ki = keyIndex.get(k);
      if (ki === undefined) {
        ki = keys.length;
        keys.push(k);
        keyIndex.set(k, ki);
      }
      const vk = `${typeof v}:${String(v)}`;
      let vi = valueIndex.get(vk);
      if (vi === undefined) {
        vi = values.length;
        values.push(encodeValue(v));
        valueIndex.set(vk, vi);
      }
      tags.push(ki, vi);
    }
    if (tags.length > 0) fw.packed(2, tags);
    fw.uint(3, GEOM_CODE[f.type]);
    fw.packed(4, encodeGeometry(f.type, f.geometry));
    w.bytes(2, fw.result());
  }
  for (const k of keys) w.string(3, k);
  for (const v of values) w.bytes(4, v);
  w.uint(5, layer.extent ?? EXTENT);
  return w.result();
}

export function encodeTile(tile: VectorTile): Uint8Array {
  const w = new Writer();
  for (const layer of tile.layers) w.bytes(3, encodeLayer(layer));
  return w.result();
}

/* ------------------------------------------------------------------ decoding */

class Reader {
  pos = 0;
  constructor(
    readonly buf: Uint8Array,
    readonly end: number = buf.length,
  ) {}

  get done(): boolean {
    return this.pos >= this.end;
  }

  varint(): number {
    let result = 0;
    let factor = 1;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.end) throw new Error('mvt: truncated varint');
      const b = this.buf[this.pos++]!;
      result += (b & 0x7f) * factor;
      if (b < 0x80) return result;
      factor *= 0x80;
    }
    throw new Error('mvt: varint too long');
  }

  /** Returns a sub-reader over a length-delimited field. */
  sub(): Reader {
    const len = this.varint();
    const r = new Reader(this.buf, this.pos + len);
    r.pos = this.pos;
    this.pos += len;
    if (this.pos > this.end) throw new Error('mvt: truncated message');
    return r;
  }

  string(): string {
    const r = this.sub();
    return new TextDecoder().decode(this.buf.subarray(r.pos, r.end));
  }

  double(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true);
    this.pos += 8;
    return v;
  }

  float(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getFloat32(0, true);
    this.pos += 4;
    return v;
  }

  /** A packed or single repeated varint field. */
  packed(wire: number, into: number[]): void {
    if (wire === 0) {
      into.push(this.varint());
      return;
    }
    const r = this.sub();
    while (!r.done) into.push(r.varint());
  }

  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.sub();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`mvt: unknown wire type ${wire}`);
  }
}

function decodeValue(r: Reader): TileValue {
  let value: TileValue = '';
  while (!r.done) {
    const tag = r.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 1) value = r.string();
    else if (field === 2) value = r.float();
    else if (field === 3) value = r.double();
    else if (field === 4 || field === 5) value = r.varint();
    else if (field === 6) value = unzigzag(r.varint());
    else if (field === 7) value = r.varint() !== 0;
    else r.skip(wire);
  }
  return value;
}

function decodeGeometry(type: GeomType, cmds: number[]): number[][][] {
  const parts: number[][][] = [];
  let part: number[][] = [];
  let cx = 0;
  let cy = 0;
  let i = 0;
  while (i < cmds.length) {
    const cmd = cmds[i++]!;
    const id = cmd & 0x7;
    const count = cmd >> 3;
    if (id === CLOSE_PATH) {
      if (part.length > 0) parts.push(part);
      part = [];
      continue;
    }
    for (let n = 0; n < count; n++) {
      cx += unzigzag(cmds[i++]!);
      cy += unzigzag(cmds[i++]!);
      if (id === MOVE_TO && type !== 'point') {
        if (part.length > 0) parts.push(part);
        part = [];
      }
      part.push([cx, cy]);
    }
  }
  if (part.length > 0) parts.push(part);
  return parts;
}

function decodeLayer(r: Reader): TileLayer {
  const layer: TileLayer = { name: '', features: [] };
  const keys: string[] = [];
  const values: TileValue[] = [];
  const raw: { id?: number; type: number; tags: number[]; geometry: number[] }[] = [];
  while (!r.done) {
    const tag = r.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 1) layer.name = r.string();
    else if (field === 2) {
      const fr = r.sub();
      const f: (typeof raw)[number] = { type: 0, tags: [], geometry: [] };
      while (!fr.done) {
        const ft = fr.varint();
        const ff = Math.floor(ft / 8);
        const fw = ft % 8;
        if (ff === 1) f.id = fr.varint();
        else if (ff === 2) fr.packed(fw, f.tags);
        else if (ff === 3) f.type = fr.varint();
        else if (ff === 4) fr.packed(fw, f.geometry);
        else fr.skip(fw);
      }
      raw.push(f);
    } else if (field === 3) keys.push(r.string());
    else if (field === 4) values.push(decodeValue(r.sub()));
    else if (field === 5) layer.extent = r.varint();
    else r.skip(wire);
  }
  for (const f of raw) {
    const type = GEOM_TYPE[f.type];
    if (!type) continue;
    const tags: Record<string, TileValue> = {};
    for (let i = 0; i + 1 < f.tags.length; i += 2) {
      const k = keys[f.tags[i]!];
      const v = values[f.tags[i + 1]!];
      if (k !== undefined && v !== undefined) tags[k] = v;
    }
    layer.features.push({
      ...(f.id !== undefined ? { id: f.id } : {}),
      type,
      geometry: decodeGeometry(type, f.geometry),
      tags,
    });
  }
  return layer;
}

/** Throws on malformed input (callers treat such a tile as missing). */
export function decodeTile(bytes: Uint8Array): VectorTile {
  const r = new Reader(bytes);
  const tile: VectorTile = { layers: [] };
  while (!r.done) {
    const tag = r.varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 3) tile.layers.push(decodeLayer(r.sub()));
    else r.skip(wire);
  }
  return tile;
}

/** Signed area in tile coordinates (y down): positive = clockwise on screen = exterior ring. */
export function ringArea(ring: readonly number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!);
  }
  return sum / 2;
}
