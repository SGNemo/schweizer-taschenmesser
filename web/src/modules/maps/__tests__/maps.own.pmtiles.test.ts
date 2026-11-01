import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  HEADER_LENGTH,
  decodeDirectory,
  encodePmtiles,
  findEntry,
  openPmtiles,
  parseHeader,
  plainAttribution,
  zxyToTileId,
} from '../own/pmtiles';
import { SAMPLE_ATTRIBUTION, SAMPLE_CENTER, samplePmtiles, sampleRegion } from '../own/sample';

const FILE = 'https://maps.example/nemostadt.pmtiles';

/** A host for one file: honours ranges (206) or, with `whole`, ignores them (200, the whole file). */
function host(bytes: Uint8Array, opts: { whole?: boolean; status?: number } = {}) {
  const ranges: string[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const range = String((init?.headers as Record<string, string> | undefined)?.Range ?? '');
    ranges.push(range);
    if (opts.status) return new Response(null, { status: opts.status });
    if (opts.whole) return new Response(bytes.slice(), { status: 200 });
    const m = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!m) throw new Error('no range');
    const start = Number(m[1]);
    const end = Math.min(Number(m[2]), bytes.length - 1);
    return new Response(bytes.slice(start, end + 1), { status: 206 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, ranges, mock: fetch as Mock };
}

const u8 = (b: ArrayBuffer) => new Uint8Array(b);

describe('PMTiles ids and header', () => {
  it('numbers tiles like the spec: the zooms above first, then the Hilbert position in the zoom', () => {
    const known: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
      [2, 0, 0],
    ];
    expect(known.map(([z, x, y]) => zxyToTileId(z, x, y))).toEqual([0, 1, 2, 3, 4, 5]);
    // Every tile of a zoom has its own id and all of them form one block after the zooms above.
    const ids = new Set<number>();
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) ids.add(zxyToTileId(3, x, y));
    expect(ids.size).toBe(64);
    expect(Math.min(...ids)).toBe(1 + 4 + 16);
    expect(Math.max(...ids)).toBe(1 + 4 + 16 + 63);
    expect(() => zxyToTileId(2, 4, 0)).toThrow(/out of range/);
  });

  it('reads back what the fixture writer put into the header, and refuses other files', () => {
    const bytes = samplePmtiles();
    const h = parseHeader(bytes);
    expect(h.minZoom).toBe(12);
    expect(h.maxZoom).toBe(16);
    expect(h.tileType).toBe(1);
    expect(h.internalCompression).toBe('none');
    expect(h.tileCompression).toBe('none');
    expect(h.clustered).toBe(true);
    expect(h.rootDirOffset).toBe(HEADER_LENGTH);
    expect(h.leafDirLength).toBe(0);
    expect(h.tileEntries).toBe(sampleRegion().tiles.length);
    expect(h.bounds.minLat).toBeLessThan(SAMPLE_CENTER.lat);
    expect(h.bounds.maxLat).toBeGreaterThan(SAMPLE_CENTER.lat);
    expect(h.bounds.minLon).toBeLessThan(SAMPLE_CENTER.lon);
    expect(h.bounds.maxLon).toBeGreaterThan(SAMPLE_CENTER.lon);
    expect(h.centerZoom).toBe(12);
    expect(() => parseHeader(bytes.subarray(0, 100))).toThrow(/short/);
    const other = bytes.slice();
    other[0] = 0x51;
    expect(() => parseHeader(other)).toThrow(/not a PMTiles/);
    const v2 = bytes.slice();
    v2[7] = 2;
    expect(() => parseHeader(v2)).toThrow(/version 2/);
  });
});

describe('PMTiles directories', () => {
  it('decodes deltas, run lengths and contiguous offsets; findEntry knows runs and leaves', () => {
    // Three entries: id 5 (10 bytes at 0), ids 6–8 as one run (20 bytes, contiguous), a leaf at id 20.
    const bytes = Uint8Array.from([3, 5, 1, 14, 1, 3, 0, 10, 20, 7, 1, 0, 101]);
    const dir = decodeDirectory(bytes);
    expect(dir).toEqual([
      { tileId: 5, runLength: 1, length: 10, offset: 0 },
      { tileId: 6, runLength: 3, length: 20, offset: 10 },
      { tileId: 20, runLength: 0, length: 7, offset: 100 },
    ]);
    expect(findEntry(dir, 4)).toBeUndefined();
    expect(findEntry(dir, 5)?.tileId).toBe(5);
    expect(findEntry(dir, 8)?.tileId).toBe(6);
    expect(findEntry(dir, 9)).toBeUndefined();
    expect(findEntry(dir, 30)?.runLength).toBe(0);
    expect(() => decodeDirectory(bytes.subarray(0, 5))).toThrow(/truncated/);
  });
});

describe('opening a region file', () => {
  it('reads header, root directory and metadata with the first request, then one range per tile', async () => {
    const { fetch, ranges, mock } = host(samplePmtiles());
    const file = await openPmtiles(FILE, { fetch, headers: { 'X-Nemo': '1' } });
    expect(ranges).toEqual(['bytes=0-16383']);
    expect(file.url).toBe(FILE);
    expect(file.metadata).toEqual({ name: 'Nemostadt', attribution: SAMPLE_ATTRIBUTION });
    expect(file.covers(SAMPLE_CENTER)).toBe(true);
    expect(file.covers({ lat: 48, lon: 9 })).toBe(false);
    const sample = sampleRegion().tiles[0]!.data;
    const tile = await file.getTile(sample.z, sample.x, sample.y);
    expect(tile?.gzip).toBe(false);
    expect(u8(tile!.bytes)).toEqual(u8(sample.bytes));
    expect(ranges).toHaveLength(2);
    expect(ranges[1]).toMatch(/^bytes=\d+-\d+$/);
    // The identification header travels with every request.
    for (const call of mock.mock.calls)
      expect((call[1] as RequestInit).headers).toMatchObject({ 'X-Nemo': '1' });
    // Zooms the file has not, and empty tiles, cost no request.
    expect(await file.getTile(5, 0, 0)).toBeUndefined();
    expect(await file.getTile(16, 0, 0)).toBeUndefined();
    expect(ranges).toHaveLength(2);
  });

  it('looks tiles up through leaf directories (one read per leaf, then remembered)', async () => {
    const bytes = samplePmtiles({ leafSize: 4 });
    expect(parseHeader(bytes).leafDirLength).toBeGreaterThan(0);
    const { fetch, ranges } = host(bytes);
    const file = await openPmtiles(FILE, { fetch });
    const tiles = sampleRegion().tiles;
    for (const t of tiles) {
      const got = await file.getTile(t.data.z, t.data.x, t.data.y);
      expect(u8(got!.bytes)).toEqual(u8(t.data.bytes));
    }
    expect(ranges).toHaveLength(1 + Math.ceil(tiles.length / 4) + tiles.length);
  });

  it('takes the slice itself when a host ignores ranges, and reports gzip tiles as such', async () => {
    const t = sampleRegion().tiles[0]!.data;
    const file = await openPmtiles(FILE, { fetch: host(samplePmtiles(), { whole: true }).fetch });
    expect(u8((await file.getTile(t.z, t.x, t.y))!.bytes)).toEqual(u8(t.bytes));

    const { region, tiles } = sampleRegion();
    const zipped = encodePmtiles({
      tiles: tiles.map((x) => ({
        z: x.data.z,
        x: x.data.x,
        y: x.data.y,
        bytes: new Uint8Array(gzipSync(new Uint8Array(x.data.bytes))),
      })),
      bounds: region.bbox,
      minZoom: 12,
      maxZoom: 16,
      gzip: true,
    });
    const g = await openPmtiles(FILE, { fetch: host(zipped).fetch });
    expect(g.header.tileCompression).toBe('gzip');
    expect(g.metadata).toEqual({});
    const got = (await g.getTile(t.z, t.x, t.y))!;
    expect(got.gzip).toBe(true);
    expect(u8(got.bytes)[0]).toBe(0x1f);
  });

  it('refuses what it cannot read: no answer, a raster file, an unknown compression', async () => {
    await expect(
      openPmtiles(FILE, { fetch: host(samplePmtiles(), { status: 404 }).fetch }),
    ).rejects.toThrow(/http 404/);
    const raster = samplePmtiles();
    raster[99] = 2;
    await expect(openPmtiles(FILE, { fetch: host(raster).fetch })).rejects.toThrow(/not a vector/);
    const brotli = samplePmtiles();
    brotli[98] = 3;
    await expect(openPmtiles(FILE, { fetch: host(brotli).fetch })).rejects.toThrow(/compression/);
  });
});

it('plainAttribution drops links and tags, squeezes whitespace and caps the length', () => {
  expect(plainAttribution(SAMPLE_ATTRIBUTION)).toBe(
    'Kartendaten © OpenStreetMap-Mitwirkende (Beispiel)',
  );
  expect(plainAttribution('  <b>a</b>\n\n b ')).toBe('a b');
  expect(plainAttribution('<a href="x"></a>')).toBeUndefined();
  expect(plainAttribution(undefined)).toBeUndefined();
  expect(plainAttribution('x'.repeat(300))).toHaveLength(200);
});
