// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetBlockedError } from '@/core/net/netlog';
import { clearTileCache, loadTile, MAX_TILES } from '../tiles';

const png = () => new Response('x', { status: 200, headers: { 'content-type': 'image/png' } });
let made = 0;
const revoked: string[] = [];

beforeEach(() => {
  made = 0;
  revoked.length = 0;
  URL.createObjectURL = () => `blob:tile-${++made}`;
  URL.revokeObjectURL = (u: string) => void revoked.push(u);
  clearTileCache();
  revoked.length = 0;
});
afterEach(() => vi.restoreAllMocks());

describe('loadTile', () => {
  it('gives a blob URL, asks once per tile and remembers it', async () => {
    const f = vi.fn(async () => png()) as unknown as typeof fetch;
    const a = await loadTile('https://t.test/1/1/1.png', f);
    const b = await loadTile('https://t.test/1/1/1.png', f);
    expect(a.src).toMatch(/^blob:tile-/);
    expect(b.src).toBe(a.src);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('shares one request between two askers at the same time', async () => {
    const f = vi.fn(async () => png()) as unknown as typeof fetch;
    const [a, b] = await Promise.all([
      loadTile('https://t.test/2/2/2.png', f),
      loadTile('https://t.test/2/2/2.png', f),
    ]);
    expect(a.src).toBe(b.src);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('names a blocked network, and treats everything else as "failed"', async () => {
    const blocked = vi.fn(async () => {
      throw new NetBlockedError();
    }) as unknown as typeof fetch;
    expect(await loadTile('https://t.test/3/3/3.png', blocked)).toEqual({ error: 'blocked' });
    const gone = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await loadTile('https://t.test/4/4/4.png', gone)).toEqual({ error: 'failed' });
    const html = vi.fn(
      async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ) as unknown as typeof fetch;
    expect(await loadTile('https://t.test/5/5/5.png', html)).toEqual({ error: 'failed' });
    const huge = vi.fn(
      async () =>
        new Response(new Uint8Array(700_000), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    ) as unknown as typeof fetch;
    expect(await loadTile('https://t.test/6/6/6.png', huge)).toEqual({ error: 'failed' });
  });

  it('keeps at most MAX_TILES in memory and releases the oldest', async () => {
    const f = vi.fn(async () => png()) as unknown as typeof fetch;
    for (let i = 0; i < MAX_TILES + 3; i++) await loadTile(`https://t.test/9/${i}/0.png`, f);
    expect(revoked).toHaveLength(3);
    expect(revoked[0]).toBe('blob:tile-1');
    clearTileCache();
    expect(revoked).toHaveLength(3 + MAX_TILES);
  });
});
