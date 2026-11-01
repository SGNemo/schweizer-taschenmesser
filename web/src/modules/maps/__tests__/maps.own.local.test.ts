// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TILES } from '../tiles';
import { createLocalTiles, tileKey, type StoredTileData } from '../own/local';
import { encodeTile } from '../own/mvt';
import { sampleRegion } from '../own/sample';
import type { RenderInput } from '../own/render';
import { fallbackPalette, type Palette } from '../own/style';

const toBuffer = (u: Uint8Array): ArrayBuffer => {
  const b = new ArrayBuffer(u.byteLength);
  new Uint8Array(b).set(u);
  return b;
};

const sample = sampleRegion();
const store = new Map<string, StoredTileData>(
  sample.tiles.map((t) => [t.id, { z: t.data.z, x: t.data.x, y: t.data.y, bytes: t.data.bytes }]),
);
const z16 = sample.tiles.find((t) => t.data.z === 16)!.data;

let made = 0;
const revoked: string[] = [];
beforeEach(() => {
  made = 0;
  revoked.length = 0;
  URL.createObjectURL = () => `blob:own-${++made}`;
  URL.revokeObjectURL = (u: string) => void revoked.push(u);
});
afterEach(() => vi.restoreAllMocks());

function source(overrides: Partial<Parameters<typeof createLocalTiles>[0]> = {}) {
  const read = vi.fn(async (id: string) => store.get(id));
  const draw = vi.fn(
    async (_input: RenderInput, _palette: Palette) => new Blob(['png'], { type: 'image/png' }),
  );
  const tiles = createLocalTiles({
    read,
    maxZoom: () => 16,
    palette: fallbackPalette,
    draw,
    dpr: () => 1,
    ...overrides,
  });
  return { tiles, read, draw };
}

describe('own map tile source', () => {
  it('draws a stored tile once and remembers the image', async () => {
    const { tiles, read, draw } = source();
    const a = await tiles.get(z16.z, z16.x, z16.y);
    const b = await tiles.get(z16.z, z16.x, z16.y);
    expect(a?.src).toBe('blob:own-1');
    expect(b).toEqual(a);
    expect(read).toHaveBeenCalledTimes(1);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0]![0]).toMatchObject({
      dataZoom: 16,
      zoom: 16,
      sub: { x: 0, y: 0 },
      size: 256,
      dpr: 1,
    });
  });

  it('shares one drawing between two askers at the same time', async () => {
    const { tiles, draw } = source();
    const [a, b] = await Promise.all([
      tiles.get(z16.z, z16.x, z16.y),
      tiles.get(z16.z, z16.x, z16.y),
    ]);
    expect(a?.src).toBe(b?.src);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('deeper zooms come from the parent tile (overzoom) with the right quarter', async () => {
    const { tiles, read, draw } = source();
    const z = 18;
    const x = z16.x * 4 + 3;
    const y = z16.y * 4 + 1;
    const hit = await tiles.get(z, x, y);
    expect(hit?.src).toBeTruthy();
    // Nothing above the stored zoom is read at all: the first look-up is the stored zoom itself.
    expect(read.mock.calls.map((c) => c[0])).toEqual([tileKey(16, z16.x, z16.y)]);
    expect(draw.mock.calls[0]![0]).toMatchObject({ dataZoom: 16, zoom: 18, sub: { x: 3, y: 1 } });
  });

  it('gives nothing without any own map, and remembers a miss without asking again', async () => {
    const none = source({ maxZoom: () => undefined });
    expect(await none.tiles.get(16, 1, 1)).toBeUndefined();
    expect(none.read).not.toHaveBeenCalled();
    const { tiles, read } = source();
    expect(await tiles.get(16, 1, 1)).toBeUndefined();
    const asked = read.mock.calls.length;
    expect(asked).toBeGreaterThan(0);
    expect(await tiles.get(16, 1, 1)).toBeUndefined();
    expect(read.mock.calls.length).toBe(asked);
  });

  it('treats unreadable bytes as missing and gives nothing where nothing can draw', async () => {
    const broken = source({
      read: async () => ({
        z: 16,
        x: 1,
        y: 1,
        bytes: toBuffer(new Uint8Array([0x1a, 0x05, 0x01])),
      }),
    });
    expect(await broken.tiles.get(16, 1, 1)).toBeUndefined();
    const blind = source({ draw: async () => undefined });
    expect(await blind.tiles.get(z16.z, z16.x, z16.y)).toBeUndefined();
  });

  it('reads gzip tiles where the browser can inflate them', async () => {
    if (typeof CompressionStream === 'undefined') return;
    const raw = encodeTile({
      layers: [
        { name: 'place', features: [{ type: 'point', geometry: [[[1, 1]]], tags: { name: 'Z' } }] },
      ],
    });
    const packed = await new Response(
      new Response(toBuffer(raw)).body!.pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer();
    const { tiles, draw } = source({
      read: async () => ({ z: 16, x: 1, y: 1, bytes: packed, gzip: true }),
    });
    expect((await tiles.get(16, 1, 1))?.src).toBeTruthy();
    expect(draw.mock.calls[0]![0].tile.layers[0]!.features[0]!.tags.name).toBe('Z');
  });

  it('keeps at most MAX_TILES images, releases the oldest, and starts over on invalidate', async () => {
    const { tiles, draw } = source({
      read: async (id) => {
        const [z, x, y] = id.split('/').map(Number) as [number, number, number];
        return { z, x, y, bytes: z16.bytes };
      },
    });
    for (let i = 0; i < MAX_TILES + 2; i++) await tiles.get(16, i, 0);
    expect(revoked).toEqual(['blob:own-1', 'blob:own-2']);
    tiles.invalidate();
    expect(revoked).toHaveLength(2 + MAX_TILES);
    await tiles.get(16, 5, 0);
    expect(draw).toHaveBeenCalledTimes(MAX_TILES + 3);
  });
});
