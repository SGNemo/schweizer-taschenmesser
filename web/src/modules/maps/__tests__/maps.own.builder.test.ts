import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { NetBlockedError } from '@/core/net/netlog';
import { createTestDb } from '@/test-utils';
import { createBuilder, useBuildStore, type BuilderDeps } from '../own/builder';
import { inlineCompute } from '../own/compute';
import { tileBbox, tileId, tilesCovering } from '../own/cut';
import { overpassBusyFixture, overpassFixture } from '../own/fixtures';
import { CELL_ZOOM } from '../own/plan';
import { encodePmtiles } from '../own/pmtiles';
import { SAMPLE_CENTER, SAMPLE_REGION_ID, samplePmtiles, sampleRegion } from '../own/sample';
import { nameSchema, regionSchema, tileSchema } from '../schema';

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

/** createAndStart for a region that surely has cells (the tests here never ask for a covered area). */
async function start(
  b: ReturnType<typeof createBuilder>,
  input: Parameters<ReturnType<typeof createBuilder>['createAndStart']>[0],
): Promise<{ id: string; capped: boolean }> {
  const r = await b.createAndStart(input);
  if (!r.id) throw new Error('no region created');
  return { id: r.id, capped: r.capped };
}

function setup(overrides: Partial<BuilderDeps> = {}) {
  const db = createTestDb();
  const regions = createRepo(tableName('maps', 'region'), regionSchema, db, { local: true });
  const tiles = createRepo(tableName('maps', 'tile'), tileSchema, db, { local: true });
  const names = createRepo(tableName('maps', 'name'), nameSchema, db, { local: true });
  const fetch = vi.fn(async () => okAnswer()) as unknown as typeof globalThis.fetch;
  const sleep = vi.fn(async (_ms: number) => undefined);
  const deps: BuilderDeps = {
    regions,
    tiles,
    names,
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
    names,
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
    const { id, capped } = await start(builder, {
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
    const { id } = await start(builder, {
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
    const { id } = await start(builder, {
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
      const { id } = await start(s.builder, {
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
    const { id } = await start(builder, {
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
    const running = await start(s.builder, {
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
    const a = await start(builder, {
      name: 'A',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    const b = await start(builder, {
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

  it('upgrades a finished lean region to the full level: z14 cells, tiles down to z16, the overview redrawn', async () => {
    const { builder, regions, tiles, fetch } = setup();
    const { id } = await start(builder, {
      name: 'Voll',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const leanCalls = fetch.mock.calls.length;
    const leanRows = await tiles.active().count();
    await builder.upgrade(id);
    const region = (await regions.get(id))!;
    expect(region.level).toBe('full');
    expect(region.cellZoom).toBe(14);
    expect(region.zooms).toEqual({ min: 8, max: 16 });
    expect(region.status).toBe('done');
    expect(region.cells.total).toBeGreaterThanOrEqual(4);
    expect(fetch.mock.calls.length - leanCalls).toBe(region.cells.total);
    expect(String((fetch.mock.calls[leanCalls]! as [string, RequestInit])[1].body)).toContain(
      encodeURIComponent('way["building"]'),
    );
    const rows = await tiles.active().toArray();
    expect(rows.length).toBeGreaterThan(leanRows);
    expect([...new Set(rows.map((r) => r.z))].sort((a, b) => a - b)).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    expect(rows.every((r) => r.regionId === id)).toBe(true);
    // A second upgrade or an upgrade of a running build does nothing.
    await builder.upgrade(id);
    expect(fetch.mock.calls.length - leanCalls).toBe(region.cells.total);
  });

  it('"Hier erweitern" leaves out cells another region holds, and makes no region for a covered area', async () => {
    const { builder, regions, tiles } = setup();
    const { id } = await start(builder, {
      name: 'Erst',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
    });
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const covered = await builder.createAndStart({
      name: 'Ausschnitt',
      bbox: one,
      centre: SAMPLE_CENTER,
      level: 'lean',
      skipBuilt: true,
    });
    expect(covered).toEqual({ capped: false, cells: 0 });
    expect(await regions.table.count()).toBe(1);
    const wider = await builder.createAndStart({
      name: 'Ausschnitt',
      bbox: three,
      centre: SAMPLE_CENTER,
      level: 'lean',
      skipBuilt: true,
    });
    expect(wider.cells).toBe(2);
    await vi.waitFor(async () => expect((await regions.get(wider.id!))!.status).toBe('done'));
    const second = (await regions.get(wider.id!))!;
    expect(second.skipCells).toHaveLength(1);
    expect(second.cells).toEqual({ done: 2, total: 2 });
    // The first region's cell tile still belongs to it.
    const firstCell = tilesCovering(one, CELL_ZOOM.lean)[0]!;
    expect((await tiles.get(`${firstCell.z}/${firstCell.x}/${firstCell.y}`))!.regionId).toBe(id);
    await builder.removeAll();
    expect(await regions.table.count()).toBe(0);
    expect(await tiles.table.count()).toBe(0);
  });
});

describe('own map from a region file', () => {
  const FILE = 'https://maps.example/nemostadt.pmtiles';
  type Calls = [unknown, RequestInit][];
  type Host = { fetch: typeof globalThis.fetch; calls: Calls };
  const fileCalls = (h: Host) => h.calls.filter(([u]) => String(u) === FILE);
  const overpassCalls = (h: Host) => h.calls.filter(([u]) => String(u) === OVERPASS);

  /** The file's host (range requests) next to Overpass; `state` lets the host fail or go away. */
  function fileFetch(
    bytes: Uint8Array,
    state: { status?: number; blockAfter?: number } = {},
  ): Host {
    let n = 0;
    const calls: Calls = [];
    const fetch = async (input: unknown, init?: RequestInit) => {
      calls.push([input, init ?? {}]);
      if (String(input) !== FILE) return okAnswer();
      n++;
      if (state.blockAfter !== undefined && n > state.blockAfter) throw new NetBlockedError();
      if (state.status) return new Response(null, { status: state.status });
      const range = String((init?.headers as Record<string, string>).Range);
      const m = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!m) throw new Error('no range');
      const start = Number(m[1]);
      const end = Math.min(Number(m[2]), bytes.length - 1);
      return new Response(bytes.slice(start, end + 1), { status: 206 });
    };
    return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
  }

  const input = { name: 'Nemostadt', bbox: one, centre: SAMPLE_CENTER, level: 'lean' as const };

  it('copies the tiles cell by cell with range requests, then the lower zooms, and credits the file', async () => {
    const host = fileFetch(samplePmtiles());
    const { builder, regions, tiles } = setup({ fetch: host.fetch });
    const r = await builder.createAndStart({ ...input, fileUrl: FILE });
    expect(r).toMatchObject({ capped: false, cells: 1, file: 'used' });
    const id = r.id!;
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const region = (await regions.get(id))!;
    expect(region).toMatchObject({
      source: 'file',
      sourceUrl: FILE,
      credit: 'Kartendaten © OpenStreetMap-Mitwirkende (Beispiel)',
      level: 'full',
      zooms: { min: 12, max: 16 },
      cellZoom: 13,
      cells: { done: 1, total: 1 },
      builtAt: 1_700_000_000_000,
    });
    expect(overpassCalls(host)).toEqual([]);
    expect(fileCalls(host).length).toBeGreaterThan(1);
    for (const [, init] of fileCalls(host))
      expect(init.headers).toMatchObject({
        Range: expect.stringMatching(/^bytes=\d+-\d+$/) as string,
        'User-Agent': 'Nemo',
      });
    const rows = await tiles.active().toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.regionId === id && !t.gzip && t.size === t.bytes.byteLength)).toBe(
      true,
    );
    expect([...new Set(rows.map((t) => t.z))].sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16]);
    // Byte for byte what the file holds, nothing computed here.
    const sample = new Map(sampleRegion().tiles.map((t) => [t.id, new Uint8Array(t.data.bytes)]));
    for (const t of rows) expect(new Uint8Array(t.bytes)).toEqual(sample.get(t.id));
    expect(region.bytes).toBe(rows.reduce((n, t) => n + t.size, 0));
    expect(useBuildStore.getState()).toEqual({ active: undefined, phase: undefined });
    // "Hier erweitern" over a covered area creates nothing, with a file as without.
    expect(await builder.createAndStart({ ...input, skipBuilt: true, fileUrl: FILE })).toEqual({
      capped: false,
      cells: 0,
      file: 'used',
    });
  });

  it('without the place in the file, or without an answer from its host, Overpass builds and the reason is named', async () => {
    const elsewhere = encodePmtiles({
      tiles: [],
      bounds: { minLat: 48, maxLat: 48.1, minLon: 9, maxLon: 9.1 },
      minZoom: 8,
      maxZoom: 14,
    });
    const ha = fileFetch(elsewhere);
    const a = setup({ fetch: ha.fetch });
    const r1 = await a.builder.createAndStart({ ...input, fileUrl: FILE });
    expect(r1.file).toBe('miss');
    await vi.waitFor(async () => expect((await a.regions.get(r1.id!))!.status).toBe('done'));
    expect(await a.regions.get(r1.id!)).toMatchObject({ source: 'overpass', level: 'lean' });
    expect(overpassCalls(ha)).toHaveLength(1);
    expect(fileCalls(ha)).toHaveLength(1); // opened once, kept for the next build

    const hb = fileFetch(samplePmtiles(), { status: 503 });
    const b = setup({ fetch: hb.fetch });
    const r2 = await b.builder.createAndStart({ ...input, fileUrl: FILE });
    expect(r2.file).toBe('unreachable');
    await vi.waitFor(async () => expect((await b.regions.get(r2.id!))!.status).toBe('done'));
    expect((await b.regions.get(r2.id!))!.source).toBe('overpass');
    expect(overpassCalls(hb)).toHaveLength(1);
  });

  it('pauses on a blocked network with what it has, continues from the file, and is never "made more detailed"', async () => {
    const state: { blockAfter?: number } = { blockAfter: 1 }; // the header, then nothing
    const host = fileFetch(samplePmtiles({ maxZoom: 14 }), state);
    const { builder, regions, tiles } = setup({ fetch: host.fetch });
    const r = await builder.createAndStart({ ...input, fileUrl: FILE });
    expect(r.file).toBe('used');
    const id = r.id!;
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('paused'));
    expect((await regions.get(id))!).toMatchObject({
      reason: 'blocked',
      cells: { done: 0, total: 1 },
      level: 'lean',
      zooms: { min: 12, max: 14 },
    });
    expect(await tiles.active().count()).toBe(0);

    delete state.blockAfter;
    await builder.start(id);
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    expect([...new Set((await tiles.active().toArray()).map((t) => t.z))].sort()).toEqual([
      12, 13, 14,
    ]);
    // A file holds what it holds: no second build at another level.
    const calls = host.calls.length;
    await builder.upgrade(id);
    expect(await regions.get(id)).toMatchObject({ level: 'lean', status: 'done' });
    expect(host.calls.length).toBe(calls);
    expect(overpassCalls(host)).toEqual([]);
  });

  it('keeps gzip tiles as the file holds them, flagged for the renderer', async () => {
    const { region, tiles: sample } = sampleRegion();
    const zipped = encodePmtiles({
      tiles: sample.map((x) => ({
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
    const { builder, regions, tiles } = setup({ fetch: fileFetch(zipped).fetch });
    const r = await builder.createAndStart({ ...input, fileUrl: FILE });
    await vi.waitFor(async () => expect((await regions.get(r.id!))!.status).toBe('done'));
    const rows = await tiles.active().toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.gzip && new Uint8Array(t.bytes)[0] === 0x1f)).toBe(true);
    expect((await regions.get(r.id!))!.credit).toBeUndefined();
  });
});

describe('names index of the own map', () => {
  const FILE = 'https://maps.example/nemostadt.pmtiles';
  const input = { name: 'Nemostadt', bbox: one, centre: SAMPLE_CENTER, level: 'lean' as const };

  it('is written per cell from the deepest tiles, rebuilt on "Genauer machen", gone with the region', async () => {
    const { builder, regions, names } = setup();
    const { id } = await start(builder, input);
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    expect((await regions.get(id))!.indexedAt).toBe(1_700_000_000_000);
    const lean = await names.active().toArray();
    expect(lean.length).toBeGreaterThan(0);
    expect(lean.every((n) => n.regionId === id && n.cell === tileId(cell.z, cell.x, cell.y))).toBe(
      true,
    );
    const byName = new Map(lean.map((n) => [n.name, n]));
    expect(byName.get('Hauptstraße')).toMatchObject({ kind: 'street', tokens: ['hauptstrasse'] });
    expect(byName.get('Nemostadt')?.kind).toBe('place');
    // POIs belong to the full level: not known yet.
    expect(byName.has('Café Flosse')).toBe(false);

    await builder.upgrade(id);
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    const full = await names.active().toArray();
    expect(full.some((n) => n.cell === tileId(cell.z, cell.x, cell.y))).toBe(false);
    expect(full.every((n) => n.regionId === id && n.cell.startsWith('14/'))).toBe(true);
    expect(full.map((n) => n.name)).toContain('Café Flosse');
    expect(full.map((n) => n.name)).toContain('Hauptstraße');

    await builder.remove(id);
    expect(await names.table.count()).toBe(0);
  });

  it('is written for a region copied from a file as well', async () => {
    const bytes = samplePmtiles();
    const fetch = async (_input: unknown, init?: RequestInit) => {
      const m = /^bytes=(\d+)-(\d+)$/.exec(String((init?.headers as Record<string, string>).Range));
      const start = Number(m![1]);
      const end = Math.min(Number(m![2]), bytes.length - 1);
      return new Response(bytes.slice(start, end + 1), { status: 206 });
    };
    const { builder, regions, names } = setup({
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const { id } = await start(builder, { ...input, fileUrl: FILE });
    await vi.waitFor(async () => expect((await regions.get(id))!.status).toBe('done'));
    expect((await regions.get(id))!.indexedAt).toBe(1_700_000_000_000);
    const rows = await names.active().toArray();
    expect(rows.map((n) => n.name)).toContain('Nemostadt');
    expect(rows.every((n) => n.regionId === id)).toBe(true);
  });

  it('ensureIndexed catches up a finished region without an index from its stored tiles, once', async () => {
    const { builder, regions, tiles, names } = setup();
    const { region, tiles: stored } = sampleRegion();
    await regions.create(region, { id: SAMPLE_REGION_ID });
    await tiles.createMany(stored.map((t) => ({ id: t.id, data: t.data })));
    expect((await regions.get(SAMPLE_REGION_ID))!.indexedAt).toBeUndefined();

    await builder.ensureIndexed();
    const rows = await names.active().toArray();
    expect(rows.map((n) => n.name)).toContain('Rathaus');
    expect(rows.map((n) => n.name)).toContain('Amselweg');
    expect(rows.every((n) => n.regionId === SAMPLE_REGION_ID)).toBe(true);
    expect((await regions.get(SAMPLE_REGION_ID))!.indexedAt).toBe(1_700_000_000_000);

    // A second run has nothing to do: the rows stay as they are.
    const before = await names.table.count();
    await builder.ensureIndexed();
    expect(await names.table.count()).toBe(before);
  });
});
