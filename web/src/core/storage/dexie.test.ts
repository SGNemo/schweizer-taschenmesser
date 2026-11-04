import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import type { FieldOp } from '@/core/sync/types';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { DexieStorageAdapter } from './dexie';

const example = allManifests.find((m) => m.id === 'example')!;
const schema = example.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };

let db: TaschenmesserDB;
let repo: Repo<Entry>;
let adapter: DexieStorageAdapter;
let clock = 1_800_000_000_000;

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  db = createTestDb();
  repo = createRepo('example_entry', schema, db) as unknown as Repo<Entry>;
  adapter = new DexieStorageAdapter(db, ['example_entry', 'todos_task']);
});
afterEach(async () => {
  setNow();
  db.close();
  await db.delete();
});

const op = (
  id: string,
  field: string,
  value: unknown,
  wall: number,
  collection = 'example_entry',
) => ({ collection, id, field, hlc: `${wall}-0000-remotedev`, value }) as FieldOp;

describe('storage adapter: reads and writes in batches', () => {
  it('reads the outbox in queue order across collections and drops entries without a record', async () => {
    const a = await repo.create({ title: 'A', done: false });
    const b = await repo.create({ title: 'B', done: false });
    // Interleave a collection the adapter knows with ghosts: an unknown collection and a deleted row.
    await db
      .table('_outbox')
      .put({ collection: 'todos_task', id: 'missing', queuedAt: clock + 1, rev: 1 });
    await db
      .table('_outbox')
      .put({ collection: 'unknown_things', id: 'x', queuedAt: clock + 2, rev: 1 });
    const c = await repo.create({ title: 'C', done: true });

    const batch = await adapter.readOutbox(50);
    expect(batch.entries.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    expect(new Set(batch.ops.map((o) => o.id))).toEqual(new Set([a.id, b.id, c.id]));
    expect(batch.ops.filter((o) => o.id === c.id && o.field === 'done')[0]!.value).toBe(true);
    // The ghosts were removed from the queue instead of blocking it.
    expect(await adapter.pendingCount()).toBe(3);
  });

  it('merges a chunk of remote records: new ones are created, newer fields win, older ones are ignored', async () => {
    const mine = await repo.create({ title: 'local', done: false });
    const result = await adapter.applyRemote([
      op('r1', 'title', 'remote one', clock + 100),
      op('r1', 'done', true, clock + 100),
      op('r2', 'title', 'remote two', clock + 101),
      op(mine.id, 'title', 'remote edit', clock + 5_000), // newer than the local write
      op(mine.id, 'done', true, 1_000), // far older: ignored
      op('t1', 'title', 'a task', clock + 102, 'todos_task'),
    ]);
    expect(result.records).toBe(4);
    expect(result.skippedUnknown).toBe(0);
    const entries = await db.table('example_entry').toArray();
    expect(entries.map((e) => e.title).sort()).toEqual(['remote edit', 'remote one', 'remote two']);
    expect(entries.find((e) => e.id === mine.id)!.done).toBe(false);
    expect(await db.table('todos_task').get('t1')).toMatchObject({ title: 'a task' });
    // Applied remote data is not queued for upload again.
    expect(await adapter.pendingCount()).toBe(1);
  });

  it('restores with markDirty: every written record is queued once', async () => {
    await adapter.applyRemote(
      [op('d1', 'title', 'x', clock + 1), op('d2', 'title', 'y', clock + 2)],
      { markDirty: true },
    );
    expect(await adapter.pendingCount()).toBe(2);
  });

  it('marks a large table dirty in slices: every record once, the revision goes up on the second call', async () => {
    const rows = Array.from({ length: 12_000 }, (_, i) => ({
      id: `bulk-${i}`,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'd',
      deletedAt: null,
      _f: {},
      title: `T${i}`,
      done: false,
    }));
    await db.table('example_entry').bulkPut(rows);
    await adapter.markAllDirty();
    expect(await adapter.pendingCount()).toBe(12_000);
    expect((await db.table('_outbox').get(['example_entry', 'bulk-0']))?.rev).toBe(1);
    await adapter.markAllDirty();
    expect(await adapter.pendingCount()).toBe(12_000);
    expect((await db.table('_outbox').get(['example_entry', 'bulk-11999']))?.rev).toBe(2);
  });
});
