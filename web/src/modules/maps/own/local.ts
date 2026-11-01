/**
 * The own map as a tile source: stored vector tiles → drawn images as `blob:` URLs, the same contract
 * the online tiles use (`../tiles.ts`), so the map component does not care where a tile comes from.
 * Deeper zooms than the stored data are drawn from the parent tile (overzoom, up to MAX_OVERZOOM
 * levels). Images are kept in memory only, least recently used first out; a theme change empties them.
 */
import { MAX_TILES } from '../tiles';
import { drawTile } from './draw';
import { decodeTile } from './mvt';
import type { RenderInput } from './render';
import { readPalette, type Palette } from './style';

export const MAX_OVERZOOM = 5;
const MAX_MISSES = 2000;
/** CSS pixel size of a drawn tile (the map's tile size). */
export const DRAW_SIZE = 256;

export interface StoredTileData {
  z: number;
  x: number;
  y: number;
  bytes: ArrayBuffer;
  gzip?: boolean;
}

export interface LocalTilesDeps {
  /** A stored tile by its id `z/x/y`. */
  read(id: string): Promise<StoredTileData | undefined>;
  /** Highest stored zoom of any region; undefined = no own map at all (then nothing is looked up). */
  maxZoom(): number | undefined;
  palette?: () => Palette;
  draw?: (input: RenderInput, palette: Palette) => Promise<Blob | undefined>;
  dpr?: () => number;
}

export interface LocalTileHit {
  src: string;
}

export interface LocalTiles {
  /** The drawn tile, or undefined when the own map has nothing here (or cannot draw). */
  get(z: number, x: number, y: number): Promise<LocalTileHit | undefined>;
  /** Forgets every drawn image (theme or data changed). */
  invalidate(): void;
}

export const tileKey = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer | undefined> {
  if (typeof DecompressionStream === 'undefined') return undefined;
  const body = new Response(bytes).body;
  if (!body) return undefined;
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export function createLocalTiles(deps: LocalTilesDeps): LocalTiles {
  const urls = new Map<string, string>();
  const misses = new Set<string>();
  const inflight = new Map<string, Promise<LocalTileHit | undefined>>();
  let palette: Palette | undefined;
  const dpr = () => Math.min(3, Math.max(1, deps.dpr?.() ?? globalThis.devicePixelRatio ?? 1));

  function remember(key: string, src: string): void {
    urls.delete(key);
    urls.set(key, src);
    while (urls.size > MAX_TILES) {
      const [oldest, url] = urls.entries().next().value as [string, string];
      urls.delete(oldest);
      release(url);
    }
  }

  function release(url: string): void {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Nothing to release.
    }
  }

  function miss(key: string): undefined {
    if (misses.size >= MAX_MISSES) misses.clear();
    misses.add(key);
    return undefined;
  }

  /** The stored tile for `z/x/y` itself or the nearest parent within the overzoom range. */
  async function find(z: number, x: number, y: number): Promise<StoredTileData | undefined> {
    const top = deps.maxZoom();
    if (top === undefined) return undefined;
    const first = Math.max(0, z - top);
    for (let dz = first; dz <= MAX_OVERZOOM; dz++) {
      const zp = z - dz;
      if (zp < 0) break;
      const hit = await deps.read(tileKey(zp, x >> dz, y >> dz));
      if (hit) return hit;
    }
    return undefined;
  }

  async function produce(
    z: number,
    x: number,
    y: number,
    key: string,
  ): Promise<LocalTileHit | undefined> {
    const stored = await find(z, x, y);
    if (!stored) return miss(key);
    let raw: ArrayBuffer | undefined = stored.bytes;
    if (stored.gzip) raw = await gunzip(stored.bytes).catch(() => undefined);
    if (!raw) return miss(key);
    let tile;
    try {
      tile = decodeTile(new Uint8Array(raw));
    } catch {
      return miss(key);
    }
    const dz = z - stored.z;
    palette ??= deps.palette?.() ?? readPalette();
    const blob = await (deps.draw ?? drawTile)(
      {
        tile,
        dataZoom: stored.z,
        zoom: z,
        sub: { x: x - (stored.x << dz), y: y - (stored.y << dz) },
        size: DRAW_SIZE,
        dpr: dpr(),
      },
      palette,
    );
    if (!blob || typeof URL.createObjectURL !== 'function') return undefined;
    const src = URL.createObjectURL(blob);
    remember(key, src);
    return { src };
  }

  return {
    get(z, x, y) {
      const key = tileKey(z, x, y);
      const hit = urls.get(key);
      if (hit) {
        remember(key, hit);
        return Promise.resolve({ src: hit });
      }
      if (misses.has(key)) return Promise.resolve(undefined);
      const running = inflight.get(key);
      if (running) return running;
      const promise = produce(z, x, y, key).finally(() => inflight.delete(key));
      inflight.set(key, promise);
      return promise;
    },
    invalidate() {
      for (const url of urls.values()) release(url);
      urls.clear();
      misses.clear();
      palette = undefined;
    },
  };
}
