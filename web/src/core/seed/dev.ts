/**
 * Test-data runner (Dev-Preview builds only; reach it through `./load`). Seeds go through the normal
 * repos (valid envelope, HLC stamps) but are registered in `_seeds` first, so sync and backup skip
 * them. Each run is one batch row in `_imports`; "remove" deletes exactly what the registry lists.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule, loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { ModuleManifest } from '@/core/modules/types';
import type { ImportBatch } from '@/core/importer/types';
import { newBatchId } from '@/core/importer/batches';
import { appHasData } from '@/core/setup/detect';
import { completeSetup, setChecklistHidden } from '@/core/setup/state';
import { now, today as realToday } from '@/core/time/now';
import { createSeedContext } from './context';
import { SEED_SYNC_KEY, SEED_TABLE, seedKey, type SeedRegistryRow } from './guard';
import { loadSeedModule } from './modules';
import type { SeedModule, SeedRows, SeedScale } from './types';

/** Bump when the runner itself changes what it writes (module versions live in the manifests). */
export const SEED_FRAMEWORK_VERSION = 1;

export const SEED_STATE_KEY = 'seed.state';
const SEED_SYNCED_ONCE_KEY = 'seed.syncedOnce';
export const SEED_BANNER_KEY = 'seed.banner';
const AUTOFILL_MARK = 'tm-seed-autofilled';
const CHUNK = 500;
export const DEMO_PASSPHRASE = 'nemo-demo';

export interface SeedState {
  scale: SeedScale;
  today: string;
  appliedAt: number;
  batchIds: string[];
  version: string;
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');
const registry = (database: TaschenmesserDB) => database.table<SeedRegistryRow, string>(SEED_TABLE);
const outbox = (database: TaschenmesserDB) => database.table('_outbox');
const imports = (database: TaschenmesserDB) => database.table<ImportBatch, string>('_imports');
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** "frame.sum" – changes whenever any seed version changes. */
export function seedVersion(manifests: readonly ModuleManifest[] = availableManifests()): string {
  const sum = manifests.reduce((n, m) => n + m.seed.version, 0);
  return `${SEED_FRAMEWORK_VERSION}.${sum}`;
}

/** Manifests ordered so every module comes after the ones in its `dependsOn`. */
export function orderBySeedDeps(manifests: readonly ModuleManifest[]): ModuleManifest[] {
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const done = new Set<string>();
  const out: ModuleManifest[] = [];
  const visit = (m: ModuleManifest, trail: string[]) => {
    if (done.has(m.id)) return;
    if (trail.includes(m.id))
      throw new Error(`seed dependency cycle: ${[...trail, m.id].join(' → ')}`);
    for (const dep of m.seed.dependsOn) {
      const d = byId.get(dep);
      if (d) visit(d, [...trail, m.id]);
    }
    done.add(m.id);
    out.push(m);
  };
  for (const m of manifests) visit(m, []);
  return out;
}

export interface PlannedWrite {
  manifest: ModuleManifest;
  collection: string;
  items: { id: string; data: Record<string, unknown> }[];
}

/** Resolves the collections of `rows` (own or `<module>.<collection>`) and checks the contract. */
export function planRows(
  owner: ModuleManifest,
  rows: SeedRows,
  manifests: readonly ModuleManifest[],
): PlannedWrite[] {
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const plan: PlannedWrite[] = [];
  for (const [key, items] of Object.entries(rows)) {
    const dot = key.indexOf('.');
    const target = dot < 0 ? owner : byId.get(key.slice(0, dot));
    const collection = dot < 0 ? key : key.slice(dot + 1);
    if (!target) throw new Error(`${owner.id}: seed writes to unknown module "${key}"`);
    if (target.id !== owner.id && !owner.seed.dependsOn.includes(target.id))
      throw new Error(`${owner.id}: seed writes to ${target.id} without dependsOn`);
    if (!target.dataSchema.collections[collection])
      throw new Error(`${owner.id}: seed writes to unknown collection "${key}"`);
    plan.push({ manifest: target, collection, items });
  }
  return plan;
}

async function writePlan(
  database: TaschenmesserDB,
  batchId: string,
  write: PlannedWrite,
  recorded: Map<string, Set<string>>,
  onProgress?: (n: number) => void,
): Promise<void> {
  const table = tableName(write.manifest.id, write.collection);
  const repo = createCollectionRepo(write.manifest, write.collection, database);
  for (let i = 0; i < write.items.length; i += CHUNK) {
    const chunk = write.items.slice(i, i + CHUNK);
    // Registry first: a crash in between leaves registered rows, never un-registered ones that sync.
    await registry(database).bulkPut(
      chunk.map((it) => ({ id: seedKey(table, it.id), table, rowId: it.id, batchId })),
    );
    await repo.createMany(chunk.map((it) => ({ data: it.data, id: it.id })));
    await outbox(database).bulkDelete(chunk.map((it) => [table, it.id]));
    const ids = recorded.get(write.collection + '|' + table) ?? new Set<string>();
    for (const it of chunk) ids.add(it.id);
    recorded.set(write.collection + '|' + table, ids);
    onProgress?.(chunk.length);
    await yieldToUi();
  }
}

export interface ApplyOptions {
  scale: SeedScale;
  /** Reference date; default is the real today. */
  today?: string;
  database?: TaschenmesserDB;
  manifests?: readonly ModuleManifest[];
  /** Switch all modules on and finish the setup assistant (the dev app default). */
  prepareApp?: boolean;
  /** Run the modules' `afterSeed` hooks (vault demo). Default true; unit tests switch it off. */
  afterSeed?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export async function applySeed(opts: ApplyOptions): Promise<SeedState> {
  const database = opts.database ?? defaultDb;
  const manifests = opts.manifests ?? availableManifests();
  const today = opts.today ?? realToday();
  const ordered = orderBySeedDeps(manifests);

  if (opts.prepareApp !== false) {
    const states = await loadModuleStates(manifests, database);
    for (const m of ordered) if (!states[m.id]) await enableModule(m, database);
  }

  const batchId = `seed-${newBatchId()}`;
  const modules = new Map<string, SeedModule>();
  const plans: PlannedWrite[] = [];
  for (const m of ordered) {
    if (m.seed.none) continue;
    const mod = await loadSeedModule(m.id);
    if (!mod) throw new Error(`${m.id}: seed.ts is missing`);
    modules.set(m.id, mod);
    plans.push(
      ...planRows(
        m,
        mod.seed(createSeedContext({ moduleId: m.id, today, scale: opts.scale })),
        manifests,
      ),
    );
  }

  const total = plans.reduce((n, p) => n + p.items.length, 0);
  let done = 0;
  const recorded = new Map<string, Set<string>>();
  for (const write of plans) {
    await writePlan(database, batchId, write, recorded, (n) =>
      opts.onProgress?.((done += n), total),
    );
  }
  const records = [...recorded].map(([key, ids]) => ({
    collection: key.split('|')[0]!,
    ids: [...ids],
    table: key.split('|')[1]!,
  }));

  for (const m of ordered) {
    const mod = modules.get(m.id);
    if (!mod?.afterSeed || opts.afterSeed === false) continue;
    const created =
      (await mod.afterSeed(createSeedContext({ moduleId: m.id, today, scale: opts.scale }))) ?? [];
    for (const c of created) {
      const table = tableName(m.id, c.collection);
      await registry(database).bulkPut(
        c.ids.map((id) => ({ id: seedKey(table, id), table, rowId: id, batchId })),
      );
      await outbox(database).bulkDelete(c.ids.map((id) => [table, id]));
      records.push({ collection: c.collection, ids: c.ids, table });
    }
  }

  const at = now();
  await imports(database).put({
    id: batchId,
    moduleId: 'seed',
    importerId: 'seed',
    source: `seed:${opts.scale}:${today}`,
    createdAt: at,
    committedAt: at,
    records: records.map(({ collection, ids }) => ({ collection, ids })),
    status: 'committed',
  });

  if (opts.prepareApp !== false) {
    await completeSetup(database);
    await setChecklistHidden(true, database);
  }
  const previous = (await meta(database).get(SEED_STATE_KEY))?.value as SeedState | undefined;
  const state: SeedState = {
    scale: opts.scale,
    today,
    appliedAt: at,
    batchIds: [...(previous?.batchIds ?? []), batchId],
    version: seedVersion(manifests),
  };
  await meta(database).put({ key: SEED_STATE_KEY, value: state });
  return state;
}

export async function readSeedState(
  database: TaschenmesserDB = defaultDb,
): Promise<SeedState | undefined> {
  return (await meta(database).get(SEED_STATE_KEY))?.value as SeedState | undefined;
}

/**
 * Removes exactly the registered seed rows; real data stays. Rows that were once allowed to sync are
 * tombstoned (so the removal reaches the server), all others are deleted outright.
 */
export async function removeSeed(
  database: TaschenmesserDB = defaultDb,
  manifests: readonly ModuleManifest[] = availableManifests(),
): Promise<{ removed: number }> {
  for (const m of manifests) {
    const mod = m.seed.none ? undefined : await loadSeedModule(m.id);
    await mod?.beforeRemove?.();
  }
  const rows = await registry(database).toArray();
  const syncedOnce = (await meta(database).get(SEED_SYNCED_ONCE_KEY))?.value === true;
  const byTable = new Map<string, string[]>();
  for (const r of rows) byTable.set(r.table, [...(byTable.get(r.table) ?? []), r.rowId]);

  let removed = 0;
  for (const [table, ids] of byTable) {
    if (!database.tables.some((t) => t.name === table)) continue;
    const owner = manifests.find((m) =>
      Object.keys(m.dataSchema.collections).some((c) => tableName(m.id, c) === table),
    );
    const collection =
      owner &&
      Object.keys(owner.dataSchema.collections).find((c) => tableName(owner.id, c) === table);
    if (syncedOnce && owner && collection && !owner.dataSchema.collections[collection]!.local) {
      await createCollectionRepo(owner, collection, database).removeMany(ids);
    } else {
      await database.table(table).bulkDelete(ids);
      await outbox(database).bulkDelete(ids.map((id) => [table, id]));
    }
    removed += ids.length;
  }
  await registry(database).clear();
  const at = now();
  for (const b of await imports(database)
    .where('importerId')
    .equals('seed')
    .toArray()
    .catch(() => [])) {
    await imports(database).put({ ...b, status: 'undone', undoneAt: at });
  }
  await meta(database).delete(SEED_STATE_KEY);
  return { removed };
}

/** Allows (or stops) syncing of seed rows. Turning it on queues them once; turning it off keeps what was sent. */
export async function setSeedSync(
  on: boolean,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await meta(database).put({ key: SEED_SYNC_KEY, value: on });
  if (!on) return;
  await meta(database).put({ key: SEED_SYNCED_ONCE_KEY, value: true });
  const rows = await registry(database).toArray();
  const queuedAt = now();
  await outbox(database).bulkPut(
    rows.map((r) => ({ collection: r.table, id: r.rowId, queuedAt, rev: 1 })),
  );
}

export async function isSeedSyncOn(database: TaschenmesserDB = defaultDb): Promise<boolean> {
  return (await meta(database).get(SEED_SYNC_KEY))?.value === true;
}

/** Deletes the whole local database and reloads – the typed-confirmation "reset all". */
export async function resetEverything(database: TaschenmesserDB = defaultDb): Promise<void> {
  // The auto-fill mark lives outside the database, so a reset really leaves an empty app.
  safeLocal(() => localStorage.setItem(AUTOFILL_MARK, '1'));
  database.close();
  await database.delete();
  location.reload();
}

function safeLocal(fn: () => void): void {
  try {
    fn();
  } catch {
    // storage blocked – nothing to remember
  }
}

/** First start of a dev build with an empty database: fill it once (never over existing data). */
export async function autoFillIfEmpty(database: TaschenmesserDB = defaultDb): Promise<boolean> {
  let marked = false;
  safeLocal(() => (marked = localStorage.getItem(AUTOFILL_MARK) === '1'));
  if (marked) return false;
  if (await readSeedState(database)) return false;
  const hasData = await appHasData(database, availableManifests());
  if (hasData) {
    safeLocal(() => localStorage.setItem(AUTOFILL_MARK, '1'));
    return false;
  }
  await applySeed({ scale: 'medium', database });
  await meta(database).put({ key: SEED_BANNER_KEY, value: true });
  safeLocal(() => localStorage.setItem(AUTOFILL_MARK, '1'));
  return true;
}
