import { describe, expect, it, vi } from 'vitest';
import { cacheFirst, isLazyAsset, LAZY_CACHE, LAZY_MAX, overflow } from './lazyCache';

const ORIGIN = 'https://app.example';

/** In-memory Cache/CacheStorage with the insertion order of the real one. */
function fakeStorage() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (r: Request) => entries.get(r.url)?.clone()),
    put: vi.fn(async (r: Request, res: Response) => {
      entries.delete(r.url);
      entries.set(r.url, res);
    }),
    keys: vi.fn(async () => [...entries.keys()].map((u) => new Request(u))),
    delete: vi.fn(async (r: Request) => entries.delete(r.url)),
  };
  const storage = { open: vi.fn(async () => cache) } as unknown as CacheStorage;
  return { storage, cache, entries };
}

const ok = (body: string) => {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, 'type', { value: 'basic' });
  return res;
};

describe('isLazyAsset', () => {
  it('only same-origin GETs of /assets/', () => {
    expect(isLazyAsset(new URL(`${ORIGIN}/assets/View-abc.js`), 'GET', ORIGIN)).toBe(true);
    expect(isLazyAsset(new URL(`${ORIGIN}/assets/View-abc.js`), 'POST', ORIGIN)).toBe(false);
    expect(isLazyAsset(new URL('https://other.example/assets/x.js'), 'GET', ORIGIN)).toBe(false);
    expect(isLazyAsset(new URL(`${ORIGIN}/api/x`), 'GET', ORIGIN)).toBe(false);
    expect(isLazyAsset(new URL(`${ORIGIN}/index.html`), 'GET', ORIGIN)).toBe(false);
  });
});

describe('overflow', () => {
  it('the oldest entries beyond the limit', () => {
    expect(overflow([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(overflow([1, 2], 2)).toEqual([]);
    expect(overflow([], 2)).toEqual([]);
    expect(LAZY_MAX).toBeGreaterThan(30);
  });
});

describe('cacheFirst', () => {
  it('first use fetches and keeps the file, later uses (offline too) come from the cache', async () => {
    const { storage, entries } = fakeStorage();
    const fetcher = vi.fn(async () => ok('tool code'));
    const req = new Request(`${ORIGIN}/assets/View-abc.js`);
    expect(await (await cacheFirst(req, storage, fetcher)).text()).toBe('tool code');
    expect(entries.has(req.url)).toBe(true);
    const offline = vi.fn(async (): Promise<Response> => {
      throw new TypeError('Failed to fetch');
    });
    expect(await (await cacheFirst(req, storage, offline)).text()).toBe('tool code');
    expect(offline).not.toHaveBeenCalled();
    expect(storage.open).toHaveBeenCalledWith(LAZY_CACHE);
  });

  it('never keeps an error answer', async () => {
    const { storage, entries } = fakeStorage();
    const res = await cacheFirst(
      new Request(`${ORIGIN}/assets/missing.js`),
      storage,
      async () => new Response('', { status: 404 }),
    );
    expect(res.status).toBe(404);
    expect(entries.size).toBe(0);
  });

  it('offline and never loaded: the fetch error reaches the page (calm note there)', async () => {
    const { storage } = fakeStorage();
    await expect(
      cacheFirst(new Request(`${ORIGIN}/assets/View-new.js`), storage, async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).rejects.toThrow('Failed to fetch');
  });

  it('keeps at most LAZY_MAX files, dropping the oldest', async () => {
    const { storage, entries } = fakeStorage();
    for (let i = 0; i < LAZY_MAX + 3; i++) {
      await cacheFirst(new Request(`${ORIGIN}/assets/c${i}.js`), storage, async () => ok(`${i}`));
    }
    expect(entries.size).toBe(LAZY_MAX);
    expect(entries.has(`${ORIGIN}/assets/c0.js`)).toBe(false);
    expect(entries.has(`${ORIGIN}/assets/c${LAZY_MAX + 2}.js`)).toBe(true);
  });
});
