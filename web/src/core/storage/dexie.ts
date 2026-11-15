import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getDeviceContext } from '@/core/db/device';
import { rwTransaction } from '@/core/db/tx';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { findConflicts, mergeOps, recordToOps, type SyncRow } from '@/core/sync/ops';
import { conflictRows } from '@/core/sync/conflictLog';
import type { FieldOp } from '@/core/sync/types';
import { seededOf, seedSyncAllowed } from '@/core/seed/guard';
import { now } from '@/core/time/now';
import type { ApplyResult, OutboxBatch, OutboxEntry, StorageAdapter } from './types';

const CURSOR_KEY = 'sync.cursor';
const EPOCH_KEY = 'sync.epoch';
/** `_meta` key of the "last pull ended complete" flag (see `StorageAdapter.setPullComplete`). */
export const PULL_COMPLETE_KEY = 'sync.pullComplete';
/** `_meta` key of the synced table names this device pulled with (sorted; see `restartForNewTables`). */
export const TABLES_KEY = 'sync.tables';
/** `_meta` key of the cursor a restart replaced (see `getReplayUntil`). */
const REPLAY_KEY = 'sync.replayUntil';
/** Records merged per Dexie transaction. */
const APPLY_CHUNK = 400;
/** Outbox rows written per transaction by `markAllDirty`. */
const DIRTY_CHUNK = 5_000;

interface OutboxRow extends OutboxEntry {
  queuedAt: number;
}

export class DexieStorageAdapter implements StorageAdapter {
  private readonly tables: Set<string>;

  constructor(
    private readonly database: TaschenmesserDB = defaultDb,
    tableNames: string[] = syncedTableNames(allManifests),
  ) {
    this.tables = new Set(tableNames);
  }

  private outbox() {
    return this.database.table<OutboxRow, [string, string]>('_outbox');
  }

  private meta() {
    return this.database.table<{ key: string; value: unknown }, string>('_meta');
  }

  async readOutbox(maxRecords: number): Promise<OutboxBatch> {
    let rows = await this.outbox().orderBy('queuedAt').limit(maxRecords).toArray();
    // Generated test data stays on the device unless the dev switch allows it.
    if (!(await seedSyncAllowed(this.database))) {
      const seeded = await seededOf(
        this.database,
        rows.map((r) => [r.collection, r.id] as const),
      );
      if (seeded.size > 0) {
        const isSeed = (r: OutboxRow) => seeded.has(`${r.collection}|${r.id}`);
        await this.outbox().bulkDelete(rows.filter(isSeed).map((r) => [r.collection, r.id]));
        rows = rows.filter((r) => !isSeed(r));
      }
    }
    const ops: FieldOp[] = [];
    const entries: OutboxEntry[] = [];
    const orphans: [string, string][] = [];
    // One read per collection instead of one per record (the records keep the outbox order below).
    const wanted = new Map<string, string[]>();
    for (const row of rows)
      if (this.tables.has(row.collection)) {
        const ids = wanted.get(row.collection) ?? [];
        ids.push(row.id);
        wanted.set(row.collection, ids);
      }
    const records = new Map<string, SyncRow | undefined>();
    for (const [collection, ids] of wanted) {
      const found = await this.database.table<SyncRow, string>(collection).bulkGet(ids);
      ids.forEach((id, i) => records.set(`${collection}\u0000${id}`, found[i]));
    }
    for (const row of rows) {
      if (!this.tables.has(row.collection)) {
        orphans.push([row.collection, row.id]);
        continue;
      }
      const record = records.get(`${row.collection}\u0000${row.id}`);
      if (!record) {
        orphans.push([row.collection, row.id]);
        continue;
      }
      ops.push(...recordToOps(row.collection, record));
      entries.push({ collection: row.collection, id: row.id, rev: row.rev ?? 0 });
    }
    if (orphans.length) await this.outbox().bulkDelete(orphans);
    return { ops, entries };
  }

  async acknowledge(entries: OutboxEntry[]): Promise<void> {
    await rwTransaction(this.database, [this.outbox()], async () => {
      const current = await this.outbox().bulkGet(entries.map((e) => [e.collection, e.id]));
      const done: [string, string][] = [];
      entries.forEach((e, i) => {
        // Written again while the push was in flight → keep it queued for the next round.
        if (current[i] && (current[i]!.rev ?? 0) === e.rev) done.push([e.collection, e.id]);
      });
      await this.outbox().bulkDelete(done);
    });
  }

  async applyRemote(
    ops: FieldOp[],
    opts: { markDirty?: boolean; replay?: boolean } = {},
  ): Promise<ApplyResult> {
    const result: ApplyResult = { applied: 0, records: 0, skippedUnknown: 0, conflicts: 0 };
    const groups = new Map<string, { collection: string; id: string; ops: FieldOp[] }>();
    let newest = '';
    for (const op of ops) {
      if (!this.tables.has(op.collection)) {
        result.skippedUnknown++;
        continue;
      }
      const key = `${op.collection}\u0000${op.id}`;
      const group = groups.get(key) ?? { collection: op.collection, id: op.id, ops: [] };
      group.ops.push(op);
      groups.set(key, group);
      if (op.hlc > newest && /^\d{13}-\d{4}-/.test(op.hlc)) newest = op.hlc;
    }
    if (groups.size === 0) return result;

    // Later local edits must sort after everything seen from remote (also with a skewed clock).
    const { clock, deviceId } = await getDeviceContext(this.database);
    if (newest) clock.receive(newest);

    const all = [...groups.values()];
    for (let i = 0; i < all.length; i += APPLY_CHUNK) {
      const chunk = all.slice(i, i + APPLY_CHUNK);
      const names = [...new Set(chunk.map((g) => g.collection))];
      const conflictTable = this.database.table('_conflicts');
      const stores = [...names.map((n) => this.database.table(n)), this.outbox(), conflictTable];
      await rwTransaction(this.database, stores, async () => {
        const dirty: OutboxRow[] = [];
        // A record with unsynced local edits that meets a remote edit of the same field is a conflict
        // (restores pass `markDirty` and are deliberate, so they are not logged; a replay after a
        // cursor restart brings ops this device saw before its local edit: no second author).
        const queued =
          opts.markDirty || opts.replay
            ? []
            : await this.outbox().bulkGet(chunk.map((g): [string, string] => [g.collection, g.id]));
        const found: ReturnType<typeof conflictRows> = [];
        // The records of the chunk are read once per collection and the merged ones written once.
        const current = new Map<string, SyncRow | undefined>();
        for (const name of names) {
          const ofName = chunk.filter((g) => g.collection === name);
          const rows = await this.database
            .table<SyncRow, string>(name)
            .bulkGet(ofName.map((g) => g.id));
          ofName.forEach((g, k) => current.set(`${name}\u0000${g.id}`, rows[k]));
        }
        const merged = new Map<string, SyncRow[]>();
        for (const [i, g] of chunk.entries()) {
          const existing = current.get(`${g.collection}\u0000${g.id}`);
          if (queued[i] && existing)
            found.push(
              ...conflictRows(g.collection, g.id, findConflicts(existing, g.ops, deviceId), now()),
            );
          const { row, changed } = mergeOps(existing, g.id, g.ops);
          if (!changed) continue;
          const list = merged.get(g.collection) ?? [];
          list.push(row);
          merged.set(g.collection, list);
          result.records++;
          result.applied += g.ops.length;
          if (opts.markDirty)
            dirty.push({ collection: g.collection, id: g.id, rev: 0, queuedAt: now() });
        }
        for (const [name, rows] of merged)
          await this.database.table<SyncRow, string>(name).bulkPut(rows);
        if (found.length) {
          await conflictTable.bulkAdd(found);
          result.conflicts! += found.length;
        }
        if (dirty.length) {
          const prev = await this.outbox().bulkGet(dirty.map((d) => [d.collection, d.id]));
          await this.outbox().bulkPut(
            dirty.map((d, k) => ({ ...d, rev: (prev[k]?.rev ?? 0) + 1 })),
          );
        }
      });
    }
    return result;
  }

  async markAllDirty(): Promise<void> {
    const allowSeeds = await seedSyncAllowed(this.database);
    for (const name of this.tables) {
      let ids = (await this.database.table(name).toCollection().primaryKeys()) as string[];
      if (!allowSeeds) {
        const seeded = await seededOf(
          this.database,
          ids.map((id) => [name, id] as const),
        );
        if (seeded.size > 0) ids = ids.filter((id) => !seeded.has(`${name}|${id}`));
      }
      // Chunked: one transaction per slice keeps the write sets small for very large tables.
      for (let from = 0; from < ids.length; from += DIRTY_CHUNK) {
        const slice = ids.slice(from, from + DIRTY_CHUNK);
        await rwTransaction(this.database, [this.outbox()], async () => {
          const prev = await this.outbox().bulkGet(slice.map((id) => [name, id]));
          const queuedAt = now();
          await this.outbox().bulkPut(
            slice.map((id, i) => ({
              collection: name,
              id,
              queuedAt,
              rev: (prev[i]?.rev ?? 0) + 1,
            })),
          );
        });
      }
    }
  }

  pendingCount(): Promise<number> {
    return this.outbox().count();
  }

  async getCursor(): Promise<number> {
    return ((await this.meta().get(CURSOR_KEY))?.value as number | undefined) ?? 0;
  }

  async setCursor(cursor: number): Promise<void> {
    await this.meta().put({ key: CURSOR_KEY, value: cursor });
  }

  async getEpoch(): Promise<string | undefined> {
    return (await this.meta().get(EPOCH_KEY))?.value as string | undefined;
  }

  async setPullComplete(complete: boolean): Promise<void> {
    await this.meta().put({ key: PULL_COMPLETE_KEY, value: complete });
  }

  async setEpoch(epoch: string | undefined): Promise<void> {
    // Another data set counts its ops anew: the replaced cursor says nothing about it.
    await this.meta().delete(REPLAY_KEY);
    if (epoch === undefined) await this.meta().delete(EPOCH_KEY);
    else await this.meta().put({ key: EPOCH_KEY, value: epoch });
  }

  async restartForNewTables(): Promise<boolean> {
    const current = [...this.tables].sort();
    return rwTransaction(this.database, [this.meta()], async () => {
      const raw = (await this.meta().get(TABLES_KEY))?.value;
      const stored = Array.isArray(raw) ? (raw as string[]) : undefined;
      if (stored?.length === current.length && current.every((n, i) => n === stored[i]))
        return false;
      // No stored set: an install from before this repair – which tables its pulls knew cannot be
      // told, so it restarts once – or a fresh one (cursor 0: nothing to restart, no loop).
      const known = new Set(stored);
      const grew = !stored || current.some((name) => !known.has(name));
      const cursor = await this.getCursor();
      const restart = grew && cursor > 0;
      if (restart) {
        const before = ((await this.meta().get(REPLAY_KEY))?.value as number | undefined) ?? 0;
        await this.meta().put({ key: REPLAY_KEY, value: Math.max(before, cursor) });
        await this.meta().put({ key: CURSOR_KEY, value: 0 });
      }
      // Always the exact current set: a table that leaves and returns later counts as new again.
      await this.meta().put({ key: TABLES_KEY, value: current });
      return restart;
    });
  }

  async getReplayUntil(): Promise<number> {
    return ((await this.meta().get(REPLAY_KEY))?.value as number | undefined) ?? 0;
  }
}
