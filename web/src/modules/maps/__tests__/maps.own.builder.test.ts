import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { NetBlockedError } from '@/core/net/netlog';
import { createTestDb } from '@/test-utils';
import { createBuilder, useBuildStore, type BuilderDeps } from '../own/builder';
import { inlineCompute } from '../own/compute';
import { tileBbox, tilesCovering } from '../own/cut';
import { overpassBusyFixture, overpassFixture } from '../own/fixtures';
import { CELL_ZOOM } from '../own/plan';
import { SAMPLE_CENTER } from '../own/sample';
import { regionSchema, tileSchema } from '../schema';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** The one z13 cell around the sample centre, shrunk a little: a one-cell region. */
const cell = tilesCovering(
  {
    minLat: SAMPLE_CENTER.lat,
    maxLat: SAMPLE_CENTER.lat,
    minLon: SAMPLE_CENTER.lon,
    maxLon: SAMPLE_CENTER.lon,
  },
  CELL_ZOOM.lean,
)[0]!;
const one = (() => {
  const b = tileBbox(cell.z, cell.x, cell.y);
  const dLat = (b.maxLat - b.minLat) / 10;
  const dLon = (b.maxLon - b.minLon) / 10;
  return {
    minLat: b.minLat + dLat,
    maxLat: b.maxLat - dLat,
    minLon: b.minLon + dLon,
    maxLon: b.maxLon - dLon,
  };
})();
/** Three cells in a row. */
const three = (() => {
  const b = tileBbox(cell.z, cell.x, cell.y);
  const dLat = (b.maxLat - b.minLat) / 10;
  const w = b.maxLon - b.minLon;
  return {
    minLat: b.minLat + dLat,
    maxLat: b.maxLat - dLat,
    minLon: b.minLon + w / 10,
    maxLon: b.minLon + w * 2.5,
  };
})();

const okAnswer = () => new Response(JSON.stringify(overpassFixture()), { status: 200 });

function setup(overrides: Partial<BuilderDeps> = {}) {
  const db = createTestDb();
  const regions = createRepo(tableName('maps', 'region'), regionSchema, db, { local: true });
  const tiles = createRepo(tableName('maps', 'tile'), tileSchema, db, { local: true });
  const fetch = vi.fn(async () => okAnswer()) as unknown as typeof globalThis.fetch;
  const sleep = vi.fn(async (_ms: number) => undefined);
  const deps: BuilderDeps = {
    regions,
    tiles,
    fetch,
    headers: () => ({ 'User-Agent': 'Nemo' }),
    overpassUrl: () => OVERPASS,
    compute: inlineCompute,
    sleep,
    clock: () => 1_700_000_000_000,
    retryDelays: [1, 2, 3],
    cellGapMs: 0,
    ...overrides,
  };
  return {
    db,
    regions,
    tiles,
    fetch: fetch as unknown as ReturnType<typeof vi.fn>,
    sleep,
    builder: createBuilder(deps),
  };
}

beforeEach(() => useBuildStore.setState({ active: undefined, phase: undefined }));
afterEach(() => vi.restoreAllMocks());

describe('own map builder', () => {
  it('builds a region cell by cell, then the overview, and finishes with a date and size', async () => {
    const { builder, regions, tiles, fetch } = setup();
    const { id, capped } = await builder.createAndStart({
      name: 'Nemostadt',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    expect(capped).toBe(false);
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const region = (await regions.get(id))!;
    expect(region.cells).toEqual({ done: 1, total: 1 });
    expect(region.builtAt).toBe(1_700_000_000_000);
    expect(region.bytes).toBeGreaterThan(0);
    expect(region.source).toBe('overpass');
    const rows = await tiles.active().toArray();
    const zooms = [...new Set(rows.map((r) => r.z))].sort((a, b) => a - b);
    expect(zooms).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(rows.every((r) => r.regionId === id && r.size === r.bytes.byteLength)).toBe(true);
    expect(region.bytes).toBe(rows.reduce((n, r) => n + r.size, 0));
    // One POST per cell, the query in the body, the identification header along, nothing else.
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(OVERPASS);
    expect(init.method).toBe('POST');
    expect(String(init.body)).toMatch(/^data=%5Bout%3Ajson%5D/);
    expect(init.headers).toMatchObject({ 'User-Agent': 'Nemo' });
    expect(useBuildStore.getState()).toEqual({ active: undefined, phase: undefined });
    // Nothing of it is queued for sync.
    expect(await regions.table.count()).toBe(1);
  });

  it('pauses between cells, keeps what is built, and continues where it stopped', async () => {
    let release: () => void = () => undefined;
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls++;
      if (calls === 2) await new Promise<void>((r) => (release = r));
      return okAnswer();
    }) as unknown as typeof globalThis.fetch;
    const { builder, regions, tiles } = setup({ fetch });
    const { id } = await builder.createAndStart({
      name: 'Drei',
      bbox: three,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    expect((await regions.get(id))!.cells.total).toBe(3);
    await vi.waitFor(() => expect(calls).toBe(2));
    expect(useBuildStore.getState()).toEqual({ active: id, phase: 'cells' });
    await builder.pause(id);
    release();
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('paused'));
    const paused = (await regions.get(id))!;
    expect(paused.cells.done).toBe(2);
    expect(paused.reason).toBeUndefined();
    const builtSoFar = await tiles.active().count();
    expect(builtSoFar).toBeGreaterThan(0);
    expect(useBuildStore.getState().active).toBeUndefined();

    await builder.start(id);
    const done = (await regions.get(id))!;
    expect(done.status).toBe('done');
    expect(calls).toBe(3);
    expect(await tiles.active().count()).toBeGreaterThan(builtSoFar);
  });

  it('a busy server is retried with growing pauses, then the build pauses with a reason', async () => {
    const fetch = vi.fn(
      async () => new Response('', { status: 429 }),
    ) as unknown as typeof globalThis.fetch;
    const { builder, regions, tiles, sleep } = setup({ fetch });
    const { id } = await builder.createAndStart({
      name: 'Busy',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('paused'));
    expect((await regions.get(id))!.reason).toBe('busy');
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(await tiles.active().count()).toBe(0);
  });

  it('names the other reasons: blocked network (no retry), unreachable, unreadable, overloaded', async () => {
    const run = async (fetch: typeof globalThis.fetch) => {
      const s = setup({ fetch });
      const { id } = await s.builder.createAndStart({
        name: 'X',
        bbox: one,
        centre: SAMPLE_CENTER,
        level: 'lean',
      });
      await vi.waitFor(async () => expect((await s.regions.get(id))!.status).toBe('paused'));
      return { reason: (await s.regions.get(id))!.reason, sleeps: s.sleep.mock.calls.length };
    };
    expect(
      await run(
        vi.fn(async () => {
          throw new NetBlockedError();
        }) as unknown as typeof globalThis.fetch,
      ),
    ).toEqual({ reason: 'blocked', sleeps: 0 });
    expect(
      await run(
        vi.fn(async () => {
          throw new TypeError('fetch failed');
        }) as unknown as typeof globalThis.fetch,
      ),
    ).toEqual({ reason: 'network', sleeps: 3 });
    expect(
      await run(
        vi.fn(
          async () => new Response('<html>', { status: 200 }),
        ) as unknown as typeof globalThis.fetch,
      ),
    ).toMatchObject({ reason: 'error' });
    expect(
      await run(
        vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof globalThis.fetch,
      ),
    ).toMatchObject({ reason: 'error' });
    expect(
      await run(
        vi.fn(
          async () => new Response(JSON.stringify(overpassBusyFixture()), { status: 200 }),
        ) as unknown as typeof globalThis.fetch,
      ),
    ).toMatchObject({ reason: 'busy' });
  });

  it('removes a region with all its tiles, also while it is being built', async () => {
    const { builder, regions, tiles } = setup();
    const { id } = await builder.createAndStart({
      name: 'Weg',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const other = await regions.create({
      name: 'Bleibt',
      bbox: one,
      level: 'lean',
      zooms: { min: 8, max: 14 },
      cellZoom: 13,
      cells: { done: 0, total: 1 },
      status: 'paused',
      bytes: 0,
    });
    await tiles.create(
      { regionId: other.id, z: 5, x: 1, y: 1, bytes: new ArrayBuffer(3), gzip: false, size: 3 },
      { id: '5/1/1' },
    );
    await builder.remove(id);
    expect(await regions.get(id)).toBeUndefined();
    expect(await regions.table.count()).toBe(1);
    expect(await tiles.active().count()).toBe(1);
    expect((await tiles.get('5/1/1'))?.regionId).toBe(other.id);

    let release: () => void = () => undefined;
    const slow = vi.fn(async () => {
      await new Promise<void>((r) => (release = r));
      return okAnswer();
    }) as unknown as typeof globalThis.fetch;
    const s = setup({ fetch: slow });
    const running = await s.builder.createAndStart({
      name: 'Lang',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
    const removal = s.builder.remove(running.id);
    release();
    await removal;
    expect(await s.regions.get(running.id)).toBeUndefined();
    expect(await s.tiles.active().count()).toBe(0);
  });

  it('runs one region at a time; a queued one can be paused at once; a restart leaves builds paused', async () => {
    const { builder, regions } = setup();
    const a = await builder.createAndStart({
      name: 'A',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    const b = await builder.createAndStart({
      name: 'B',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(async () => expect((await regions.get(b.id))!.status).toBe('done'));
    expect((await regions.get(a.id))!.status).toBe('done');

    const c = await regions.create({
      name: 'C',
      bbox: one,
      level: 'lean',
      zooms: { min: 8, max: 14 },
      cellZoom: 13,
      cells: { done: 0, total: 1 },
      status: 'building',
      bytes: 0,
    });
    await builder.pause(c.id);
    expect((await regions.get(c.id))!.status).toBe('paused');
    await regions.update(c.id, { status: 'building' });
    await builder.settle();
    expect((await regions.get(c.id))!.status).toBe('paused');
  });
});
