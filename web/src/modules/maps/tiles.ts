/**
 * Map tiles as local `blob:` URLs: fetched through the platform (the connection log sees them, "Netzwerk
 * sperren" applies, the app's image policy stays strict), kept in memory only (a few hundred, least
 * recently used first out), never stored on disk. One request per tile at a time.
 */
import { NetBlockedError } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { identify } from './agent';

export const MAX_TILES = 300;
const MAX_BYTES = 600_000;

export interface TileResult {
  src?: string;
  error?: 'blocked' | 'failed';
  /** HTTP status of a refused tile, for the message. */
  status?: number;
}

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<TileResult>>();

function remember(url: string, src: string): void {
  cache.delete(url);
  cache.set(url, src);
  while (cache.size > MAX_TILES) {
    const [oldest, blob] = cache.entries().next().value as [string, string];
    cache.delete(oldest);
    try {
      URL.revokeObjectURL(blob);
    } catch {
      // Nothing to release.
    }
  }
}

/** The tile at `url`, or why there is none. Never throws. */
export function loadTile(
  url: string,
  f: typeof fetch = (i, n) => getPlatform().fetch(i, n),
): Promise<TileResult> {
  const hit = cache.get(url);
  if (hit) {
    remember(url, hit);
    return Promise.resolve({ src: hit });
  }
  const running = inflight.get(url);
  if (running) return running;
  const promise = (async (): Promise<TileResult> => {
    try {
      if (typeof URL.createObjectURL !== 'function') return { error: 'failed' };
      const res = await f(url, { signal: AbortSignal.timeout(10_000), ...identify() });
      if (!res.ok) return { error: 'failed', status: res.status };
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') || blob.size > MAX_BYTES) return { error: 'failed' };
      const src = URL.createObjectURL(blob);
      remember(url, src);
      return { src };
    } catch (e) {
      return { error: e instanceof NetBlockedError ? 'blocked' : 'failed' };
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, promise);
  return promise;
}

export function clearTileCache(): void {
  for (const blob of cache.values()) {
    try {
      URL.revokeObjectURL(blob);
    } catch {
      // Nothing to release.
    }
  }
  cache.clear();
}
