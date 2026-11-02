/**
 * Builds own-map regions: one Overpass request per cell through the platform fetch (connection log,
 * "Netzwerk sperren"), the answer handed to the compute worker, the tiles written through the repos,
 * the region row updated after every cell (the map fills visibly). Nothing starts by itself: `start`
 * is a click; a build found running after a restart is set to "paused" and offers "Weiter". One
 * region at a time, a short breath between requests, a few retries with growing pauses when the
 * donated server is busy, then a calm pause with a reason. With a region file (PMTiles on an own host)
 * the tiles are copied from the file instead, cell by cell, with range requests. Every written cell
 * also refreshes the names index (`maps_name`) the search field answers from.
 */
import { create } from 'zustand';
import type { Repo } from '@/core/db/repo';
import { NetBlockedError } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { identify } from '../agent';
import { nameRepo, regionRepo, tileRepo } from '../repo';
import type { MapLevel, NameRow, Region, Tile } from '../schema';
import { defaultCompute, type Compute } from './compute';
import { tileId, tilesCovering, type Bbox, type LonLat, type TileAddress } from './cut';
import { gunzip } from './gzip';
import { tokensOf, type NameEntry } from './names';
import { DEFAULT_OVERPASS_URL, overpassQuery } from './overpass';
import { openPmtiles, plainAttribution, type Pmtiles } from './pmtiles';
import { STORED_ZOOMS, capBbox, cellBbox, planRegion } from './plan';
import { tilesUnder, type TileBytes } from './work';

export type PauseReason = 'busy' | 'network' | 'blocked' | 'error';

export interface BuildState {
  /** Region being built right now. */
  active?: string;
  /** `cells` = fetching, `overview` = drawing the lower zooms from the stored tiles. */
  phase?: 'cells' | 'overview';
}

export const useBuildStore = create<BuildState>(() => ({}));

export interface BuilderDeps {
  regions: Repo<Region>;
  tiles: Repo<Tile>;
  names: Repo<NameRow>;
  fetch: typeof fetch;
  headers: () => Record<string, string>;
  overpassUrl: () => string;
  compute: () => Compute;
  /** Opens a region file (header, root directory, metadata). */
  openFile?: (url: string) => Promise<Pmtiles>;
  sleep: (ms: number) => Promise<void>;
  clock: () => number;
  /** Pauses before the retries of a busy or unreachable server. */
  retryDelays?: number[];
  /** Breath between two cell requests (fair use). */
  cellGapMs?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
}

/** How a build with a region file went: used, or why Overpass was taken instead. */
export type FileOutcome = 'used' | 'miss' | 'unreachable';

export interface Builder {
  /**
   * Creates a region and starts building it. With `skipBuilt`, cells another region already holds
   * are left out; when nothing remains, no region is created (`cells` = 0). With `fileUrl` the tiles
   * come from that region file when it covers the centre; otherwise from Overpass (`file` says why).
   */
  createAndStart(input: {
    name: string;
    bbox: Bbox;
    centre: LonLat;
    level: MapLevel;
    skipBuilt?: boolean;
    fileUrl?: string;
  }): Promise<{ id?: string; capped: boolean; cells: number; file?: FileOutcome }>;
  /** A finished lean region is built again at the full level (z14 cells, tiles down to z16). */
  upgrade(id: string): Promise<void>;
  /** (Re)starts a region; resolves when the builder stopped working on it (done, paused, removed). */
  start(id: string): Promise<void>;
  pause(id: string): Promise<void>;
  /** Purges the region and all its tiles. A running build stops first. */
  remove(id: string): Promise<void>;
  /** Purges every region and tile of the own map. */
  removeAll(): Promise<void>;
  /** After a restart: a region that was "building" when the app closed waits for "Weiter". */
  settle(): Promise<void>;
  /**
   * Builds the names index of finished regions that have none yet (built before the index existed)
   * from their stored tiles. Local work only; one run at a time.
   */
  ensureIndexed(): Promise<void>;
}

const DEFAULT_RETRY = [5_000, 15_000, 45_000];
const DEFAULT_GAP = 1_000;
const DEFAULT_TIMEOUT = 90_000;

type Fetched = { json: string } | { reason: PauseReason };

export function createBuilder(deps: BuilderDeps): Builder {
  const paused = new Set<string>();
  const removed = new Set<string>();
  /** Regions in the order they were started: first come, first built. */
  const queue: string[] = [];
  const waiters = new Map<string, (() => void)[]>();
  const files = new Map<string, Promise<Pmtiles>>();
  let pumping = false;
  let compute: Compute | undefined;
  let requestId = 0;
  let indexing: Promise<void> | undefined;

  /** The opened region file, shared between regions; a failed open is not remembered. */
  function openFile(url: string): Promise<Pmtiles> {
    const hit = files.get(url);
    if (hit) return hit;
    const open =
      deps.openFile ??
      ((u: string) => openPmtiles(u, { fetch: deps.fetch, headers: deps.headers() }));
    const p = open(url);
    files.set(url, p);
    p.catch(() => files.delete(url));
    return p;
  }

  const settled = (id: string) => {
    for (const w of waiters.get(id) ?? []) w();
    waiters.delete(id);
  };

  async function fetchCell(cell: TileAddress, level: MapLevel): Promise<Fetched> {
    const delays = deps.retryDelays ?? DEFAULT_RETRY;
    const query = overpassQuery(cellBbox(cell), level);
    let last: PauseReason = 'network';
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) await deps.sleep(delays[attempt - 1]!);
      try {
        const res = await deps.fetch(deps.overpassUrl(), {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...deps.headers() },
          signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT),
        });
        if (res.status === 429 || res.status === 503 || res.status === 504) {
          last = 'busy';
          continue;
        }
        if (!res.ok) return { reason: 'error' };
        return { json: await res.text() };
      } catch (e) {
        if (e instanceof NetBlockedError) return { reason: 'blocked' };
        last = 'network';
      }
    }
    return { reason: last };
  }

  async function writeTiles(regionId: string, tiles: TileBytes[]): Promise<number> {
    if (tiles.length === 0) return 0;
    const ids = tiles.map((t) => tileId(t.z, t.x, t.y));
    // Replace, never merge: a repeated cell must overwrite its old tiles (same id, other bytes).
    await deps.tiles.purge(ids);
    await deps.tiles.createMany(
      tiles.map((t, i) => ({
        id: ids[i]!,
        data: {
          regionId,
          z: t.z,
          x: t.x,
          y: t.y,
          bytes: t.bytes,
          gzip: t.gzip ?? false,
          size: t.bytes.byteLength,
        },
      })),
    );
    return tiles.reduce((n, t) => n + t.bytes.byteLength, 0);
  }

  /** Replaces what a cell knows by name (purged by cell, so a rebuilt cell never keeps stale names). */
  async function writeNames(
    regionId: string,
    cell: TileAddress,
    entries: NameEntry[],
  ): Promise<void> {
    const cellId = tileId(cell.z, cell.x, cell.y);
    const old = await deps.names.table.where('cell').equals(cellId).primaryKeys();
    if (old.length > 0) await deps.names.purge(old);
    if (entries.length === 0) return;
    await deps.names.createMany(
      entries.map((e, i) => ({
        id: `${cellId}#${i}`,
        data: {
          regionId,
          cell: cellId,
          name: e.name,
          tokens: tokensOf(e.name),
          kind: e.kind,
          lat: e.lat,
          lon: e.lon,
        },
      })),
    );
  }

  async function purgeNames(regionId: string): Promise<void> {
    const ids = await deps.names.table.where('regionId').equals(regionId).primaryKeys();
    if (ids.length > 0) await deps.names.purge(ids);
  }

  /** The names of stored or copied tiles (the deepest zoom of a cell), read off the page. */
  async function namesOfTiles(tiles: TileBytes[]): Promise<NameEntry[]> {
    const plain: TileBytes[] = [];
    for (const t of tiles) {
      try {
        plain.push(
          t.gzip
            ? { ...t, bytes: await gunzip(t.bytes), gzip: false }
            : { ...t, bytes: t.bytes.slice(0) },
        );
      } catch {
        // An unreadable tile has no names to offer.
      }
    }
    if (plain.length === 0) return [];
    compute ??= deps.compute();
    const res = await compute.run({ kind: 'names', id: ++requestId, tiles: plain });
    return res.kind === 'names' ? res.names : [];
  }

  /** The tiles of a region file for the given addresses, a few at a time, each tried like a cell. */
  async function readFileTiles(
    file: Pmtiles,
    addresses: TileAddress[],
  ): Promise<{ tiles: TileBytes[] } | { reason: PauseReason }> {
    const delays = deps.retryDelays ?? DEFAULT_RETRY;
    const tiles: TileBytes[] = [];
    const one = async (a: TileAddress): Promise<PauseReason | undefined> => {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) await deps.sleep(delays[attempt - 1]!);
        try {
          const t = await file.getTile(a.z, a.x, a.y);
          if (t) tiles.push({ ...a, bytes: t.bytes, gzip: t.gzip });
          return undefined;
        } catch (e) {
          if (e instanceof NetBlockedError) return 'blocked';
        }
      }
      return 'network';
    };
    for (let i = 0; i < addresses.length; i += 4) {
      const reasons = await Promise.all(addresses.slice(i, i + 4).map(one));
      const bad = reasons.find((r) => r !== undefined);
      if (bad) return { reason: bad };
    }
    return { tiles };
  }

  /** A region copied from a region file: the cells' tiles, then the lower zooms, all from the file. */
  async function runFileRegion(region: Region & { id: string }): Promise<void> {
    const id = region.id;
    let file: Pmtiles;
    try {
      file = await openFile(region.sourceUrl ?? '');
    } catch (e) {
      await deps.regions.update(id, {
        status: 'paused',
        reason: e instanceof NetBlockedError ? 'blocked' : 'network',
      });
      return;
    }
    const skip = new Set(region.skipCells ?? []);
    const cells = tilesCovering(region.bbox, region.cellZoom).filter(
      (c) => !skip.has(tileId(c.z, c.x, c.y)),
    );
    const total = cells.length;
    useBuildStore.setState({ active: id, phase: 'cells' });
    let bytes = region.bytes;
    for (let i = region.cells.done; i < total; i++) {
      if (removed.has(id)) return;
      if (paused.has(id)) {
        await deps.regions.update(id, { status: 'paused' });
        return;
      }
      const read = await readFileTiles(file, tilesUnder(cells[i]!, region.zooms.max));
      if (removed.has(id)) return;
      if ('reason' in read) {
        await deps.regions.update(id, { status: 'paused', reason: read.reason });
        return;
      }
      bytes += await writeTiles(id, read.tiles);
      await writeNames(
        id,
        cells[i]!,
        await namesOfTiles(read.tiles.filter((t) => t.z === region.zooms.max)),
      );
      await deps.regions.update(id, { cells: { done: i + 1, total }, bytes });
    }
    // The overview comes from the file as well (it holds the lower zooms already).
    useBuildStore.setState({ active: id, phase: 'overview' });
    for (let z = region.cellZoom - 1; z >= region.zooms.min; z--) {
      if (removed.has(id)) return;
      const read = await readFileTiles(file, tilesCovering(region.bbox, z));
      if ('reason' in read) {
        await deps.regions.update(id, { status: 'paused', reason: read.reason });
        return;
      }
      await writeTiles(id, read.tiles);
    }
    if (removed.has(id)) return;
    await deps.regions.update(id, {
      status: 'done',
      cells: { done: total, total },
      bytes: await bytesOf(id),
      builtAt: deps.clock(),
      indexedAt: deps.clock(),
    });
  }

  async function bytesOf(regionId: string): Promise<number> {
    const rows = await deps.tiles.table.where('regionId').equals(regionId).toArray();
    return rows.reduce((n, r) => n + r.size, 0);
  }

  async function runRegion(id: string): Promise<void> {
    const region = await deps.regions.get(id);
    if (!region) return;
    if (region.source === 'file') return runFileRegion(region);
    const plan = planRegion(region.level, region.bbox);
    const skip = new Set(region.skipCells ?? []);
    const cells = plan.cells.filter((c) => !skip.has(tileId(c.z, c.x, c.y)));
    const total = cells.length;
    compute ??= deps.compute();
    useBuildStore.setState({ active: id, phase: 'cells' });
    let bytes = region.bytes;
    for (let i = region.cells.done; i < total; i++) {
      if (removed.has(id)) return;
      if (paused.has(id)) {
        await deps.regions.update(id, { status: 'paused' });
        return;
      }
      const fetched = await fetchCell(cells[i]!, region.level);
      if (removed.has(id)) return;
      if ('reason' in fetched) {
        await deps.regions.update(id, { status: 'paused', reason: fetched.reason });
        return;
      }
      const res = await compute.run({
        kind: 'cell',
        id: ++requestId,
        level: region.level,
        cell: cells[i]!,
        maxZoom: plan.zooms.max,
        json: fetched.json,
      });
      if (removed.has(id)) return;
      if (res.kind !== 'cell' || res.error) {
        await deps.regions.update(id, {
          status: 'paused',
          reason: res.kind === 'cell' && res.error === 'busy' ? 'busy' : 'error',
        });
        return;
      }
      bytes += await writeTiles(id, res.tiles);
      await writeNames(id, cells[i]!, res.names);
      await deps.regions.update(id, { cells: { done: i + 1, total }, bytes });
      if (i + 1 < total) await deps.sleep(deps.cellGapMs ?? DEFAULT_GAP);
    }
    // The overview: lower zooms from the stored tiles, one level at a time, never from the network.
    useBuildStore.setState({ active: id, phase: 'overview' });
    for (let z = plan.cellZoom - 1; z >= plan.zooms.min; z--) {
      for (const parent of tilesCovering(region.bbox, z)) {
        if (removed.has(id)) return;
        const kids = (
          await Promise.all(
            [0, 1, 2, 3].map((k) =>
              deps.tiles.get(tileId(z + 1, parent.x * 2 + (k % 2), parent.y * 2 + (k >> 1))),
            ),
          )
        ).filter((t): t is NonNullable<typeof t> => t !== undefined && !t.gzip);
        if (kids.length === 0) continue;
        const res = await compute.run({
          kind: 'parent',
          id: ++requestId,
          parent,
          children: kids.map((t) => ({ z: t.z, x: t.x, y: t.y, bytes: t.bytes.slice(0) })),
        });
        if (res.kind === 'parent' && res.tile) await writeTiles(id, [res.tile]);
      }
    }
    if (removed.has(id)) return;
    await deps.regions.update(id, {
      status: 'done',
      cells: { done: total, total },
      bytes: await bytesOf(id),
      builtAt: deps.clock(),
      indexedAt: deps.clock(),
    });
  }

  async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        const building = (await deps.regions.active().toArray()).filter(
          (r) => r.status === 'building' && !paused.has(r.id) && !removed.has(r.id),
        );
        // Started ones first, in their order; anything else found building after them.
        const rank = (id: string) => {
          const i = queue.indexOf(id);
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        const next = building.sort(
          (a, b) => rank(a.id) - rank(b.id) || a.createdAt - b.createdAt,
        )[0];
        if (!next) break;
        const at = queue.indexOf(next.id);
        if (at !== -1) queue.splice(at, 1);
        try {
          await runRegion(next.id);
        } catch {
          await deps.regions
            .update(next.id, { status: 'paused', reason: 'error' })
            .catch(() => undefined);
        } finally {
          settled(next.id);
        }
      }
    } finally {
      pumping = false;
      useBuildStore.setState({ active: undefined, phase: undefined });
      compute?.dispose();
      compute = undefined;
    }
  }

  const builder: Builder = {
    async createAndStart({ name, bbox, centre, level, skipBuilt, fileUrl }) {
      // A region file first, when one is set and it covers the centre; Overpass otherwise.
      let file: Pmtiles | undefined;
      let outcome: FileOutcome | undefined;
      if (fileUrl) {
        try {
          file = await openFile(fileUrl);
          outcome = file.covers(centre) ? 'used' : 'miss';
        } catch {
          outcome = 'unreachable';
        }
        if (outcome !== 'used') file = undefined;
      }
      const cap = capBbox(bbox, centre, file ? 'lean' : level);
      const zooms = file
        ? {
            min: Math.max(STORED_ZOOMS.lean.min, file.header.minZoom),
            max: Math.min(STORED_ZOOMS.full.max, file.header.maxZoom),
          }
        : planRegion(level, cap.bbox).zooms;
      const cellZoom = file
        ? Math.min(planRegion('lean', cap.bbox).cellZoom, zooms.max)
        : planRegion(level, cap.bbox).cellZoom;
      const cells = tilesCovering(cap.bbox, cellZoom);
      const skipCells: string[] = [];
      if (skipBuilt) {
        for (const c of cells) {
          const id = tileId(c.z, c.x, c.y);
          if (await deps.tiles.get(id)) skipCells.push(id);
        }
      }
      const total = cells.length - skipCells.length;
      if (total === 0)
        return { capped: cap.capped, cells: 0, ...(outcome ? { file: outcome } : {}) };
      const credit = file ? plainAttribution(file.metadata.attribution) : undefined;
      const region = await deps.regions.create({
        name,
        bbox: cap.bbox,
        level: file ? (zooms.max >= 15 ? 'full' : 'lean') : level,
        zooms,
        cellZoom,
        ...(skipCells.length > 0 ? { skipCells } : {}),
        cells: { done: 0, total },
        status: 'building',
        bytes: 0,
        source: file ? 'file' : 'overpass',
        ...(file ? { sourceUrl: file.url } : {}),
        ...(credit ? { credit } : {}),
      });
      void builder.start(region.id);
      return {
        id: region.id,
        capped: cap.capped,
        cells: total,
        ...(outcome ? { file: outcome } : {}),
      };
    },
    async upgrade(id) {
      const region = await deps.regions.get(id);
      if (!region || region.level === 'full' || region.status === 'building') return;
      if (region.source === 'file') return; // a file holds what it holds
      const plan = planRegion('full', region.bbox);
      const skip = new Set(region.skipCells ?? []);
      // A lean cell that was skipped covers four full cells: skip those as well.
      const skipCells = plan.cells
        .map((c) => tileId(c.z, c.x, c.y))
        .filter((_, i) => {
          const c = plan.cells[i]!;
          return skip.has(tileId(c.z - 1, c.x >> 1, c.y >> 1));
        });
      // The full cells are new cells: the lean cells' names go, the index is rebuilt with them.
      await purgeNames(id);
      await deps.regions.update(id, {
        level: 'full',
        zooms: STORED_ZOOMS.full,
        cellZoom: plan.cellZoom,
        ...(skipCells.length > 0 ? { skipCells } : {}),
        cells: { done: 0, total: plan.cells.length - skipCells.length },
        status: 'paused',
        reason: undefined,
        indexedAt: undefined,
      });
      await builder.start(id);
    },
    async start(id) {
      paused.delete(id);
      const region = await deps.regions.get(id);
      if (!region || region.status === 'done') return;
      if (!queue.includes(id)) queue.push(id);
      await deps.regions.update(id, { status: 'building', reason: undefined });
      const done = new Promise<void>((resolve) =>
        waiters.set(id, [...(waiters.get(id) ?? []), resolve]),
      );
      void pump();
      await done;
    },
    async pause(id) {
      paused.add(id);
      // A region that waits in the queue is not touched by the loop: mark it now.
      if (useBuildStore.getState().active !== id) {
        const region = await deps.regions.get(id);
        if (region?.status === 'building') await deps.regions.update(id, { status: 'paused' });
      }
    },
    async remove(id) {
      removed.add(id);
      paused.add(id);
      if (useBuildStore.getState().active === id) {
        await new Promise<void>((resolve) =>
          waiters.set(id, [...(waiters.get(id) ?? []), resolve]),
        );
      }
      const ids = (await deps.tiles.table.where('regionId').equals(id).toArray()).map((t) => t.id);
      await deps.tiles.purge(ids);
      await purgeNames(id);
      await deps.regions.purge([id]);
      removed.delete(id);
      paused.delete(id);
    },
    async removeAll() {
      for (const r of await deps.regions.active().toArray()) await builder.remove(r.id);
    },
    async settle() {
      const active = useBuildStore.getState().active;
      for (const r of await deps.regions.active().toArray()) {
        if (r.status === 'building' && r.id !== active)
          await deps.regions.update(r.id, { status: 'paused' });
      }
    },
    ensureIndexed() {
      indexing ??= (async () => {
        for (const region of await deps.regions.active().toArray()) {
          if (region.status !== 'done' || region.indexedAt) continue;
          const skip = new Set(region.skipCells ?? []);
          const cells = tilesCovering(region.bbox, region.cellZoom).filter(
            (c) => !skip.has(tileId(c.z, c.x, c.y)),
          );
          for (const cell of cells) {
            if (removed.has(region.id)) break;
            const deepest = tilesUnder(cell, region.zooms.max).filter(
              (t) => t.z === region.zooms.max,
            );
            const rows = await deps.tiles.table.bulkGet(deepest.map((t) => tileId(t.z, t.x, t.y)));
            const tiles = rows
              .filter(
                (r): r is NonNullable<typeof r> =>
                  r !== undefined && r.deletedAt === null && r.regionId === region.id,
              )
              .map((r) => ({ z: r.z, x: r.x, y: r.y, bytes: r.bytes, gzip: r.gzip }));
            await writeNames(region.id, cell, await namesOfTiles(tiles));
          }
          if (!removed.has(region.id) && (await deps.regions.get(region.id)))
            await deps.regions.update(region.id, { indexedAt: deps.clock() });
        }
        if (!useBuildStore.getState().active) {
          compute?.dispose();
          compute = undefined;
        }
      })().finally(() => {
        indexing = undefined;
      });
      return indexing;
    },
  };
  return builder;
}

let shared: Builder | undefined;
let currentOverpassUrl = DEFAULT_OVERPASS_URL;

/** The page tells the shared builder which service the settings name (read at every request). */
export function setOverpassUrl(url: string): void {
  currentOverpassUrl = url;
}

/** The app's builder (platform fetch, module repos, a Worker where available). */
export function getBuilder(): Builder {
  shared ??= createBuilder({
    regions: regionRepo,
    tiles: tileRepo,
    names: nameRepo,
    fetch: (input, init) => getPlatform().fetch(input, init),
    headers: () => identify().headers ?? {},
    overpassUrl: () => currentOverpassUrl,
    compute: defaultCompute,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    clock: now,
  });
  return shared;
}

/** Tests only: forgets the shared builder. */
export function resetBuilder(): void {
  shared = undefined;
}
