/**
 * Runtime cache of the service worker for build files that are not precached (tools, chat, password
 * dictionaries; scripts/lib/precacheSplit.ts). They load online on first use; afterwards this cache serves
 * them, so they keep working offline. Hashed file names never change content, so cache-first is safe.
 * Old versions are not tracked: the cache keeps the newest LAZY_MAX files and drops the oldest ones.
 */
export const LAZY_CACHE = 'nemo-lazy-v1';
export const LAZY_MAX = 80;

/** Same-origin GET of a hashed build file (`/assets/…`) – the only requests this cache answers. */
export function isLazyAsset(url: URL, method: string, origin: string): boolean {
  return method === 'GET' && url.origin === origin && url.pathname.startsWith('/assets/');
}

/** The oldest entries beyond `max` (Cache.keys() lists in insertion order). */
export function overflow<T>(keys: readonly T[], max = LAZY_MAX): T[] {
  return keys.slice(0, Math.max(0, keys.length - max));
}

/** Cache-first: answer from the cache, else fetch, keep a good same-origin answer, trim the cache. */
export async function cacheFirst(
  request: Request,
  storage: CacheStorage = caches,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const cache = await storage.open(LAZY_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetcher(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    for (const old of overflow(await cache.keys())) await cache.delete(old);
  }
  return response;
}
