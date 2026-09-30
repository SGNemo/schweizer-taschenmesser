import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getDeviceContext } from '@/core/db/device';
import { rwTransaction } from '@/core/db/tx';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { findConflicts, mergeOps, recordToOps, type SyncRow } from '@/core/sync/ops';
import { conflictRows } from '@/core/sync/conflictLog';
import type { FieldOp } from '@/core/sync/types';
import { now } from '@/core/time/now';
import type { ApplyResult, OutboxBatch, OutboxEntry, StorageAdapter } from './types';

const CURSOR_KEY = 'sync.cursor';
const EPOCH_KEY = 'sync.epoch';
/** Records merged per Dexie transaction. */
const APPLY_CHUNK = 400;

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
    const rows = await this.outbox().orderBy('queuedAt').limit(maxRecords).toArray();
    const ops: FieldOp[] = [];
    const entries: OutboxEntry[] = [];
    const orphans: [string, string][] = [];
    for (const row of rows) {
      if (!this.tables.has(row.collection)) {
        orphans.push([row.collection, row.id]);
        continue;
      }
      const record = await this.database.table<SyncRow, string>(row.collection).get(row.id);
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

  async applyRemote(ops: FieldOp[], opts: { markDirty?: boolean } = {}): Promise<ApplyResult> {
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
        // (restores pass `markDirty` and are deliberate, so they are not logged).
        const queued = opts.markDirty
          ? []
          : await this.outbox().bulkGet(chunk.map((g): [string, string] => [g.collection, g.id]));
        const found: ReturnType<typeof conflictRows> = [];
        for (const [i, g] of chunk.entries()) {
          const table = this.database.table<SyncRow, string>(g.collection);
          const existing = await table.get(g.id);
          if (queued[i] && existing)
            found.push(
              ...conflictRows(g.collection, g.id, findConflicts(existing, g.ops, deviceId), now()),
            );
          const { row, changed } = mergeOps(existing, g.id, g.ops);
          if (!changed) continue;
          await table.put(row);
          result.records++;
          result.applied += g.ops.length;
          if (opts.markDirty)
            dirty.push({ collection: g.collection, id: g.id, rev: 0, queuedAt: now() });
        }
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
    for (const name of this.tables) {
      const ids = (await this.database.table(name).toCollection().primaryKeys()) as string[];
      if (ids.length === 0) continue;
      await rwTransaction(this.database, [this.outbox()], async () => {
        const prev = await this.outbox().bulkGet(ids.map((id) => [name, id]));
        const queuedAt = now();
        await this.outbox().bulkPut(
          ids.map((id, i) => ({ collection: name, id, queuedAt, rev: (prev[i]?.rev ?? 0) + 1 })),
        );
      });
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

  async setEpoch(epoch: string | undefined): Promise<void> {
    if (epoch === undefined) await this.meta().delete(EPOCH_KEY);
    else await this.meta().put({ key: EPOCH_KEY, value: epoch });
  }
}
