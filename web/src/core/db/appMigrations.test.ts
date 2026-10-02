import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import type { SyncRow } from '@/core/sync/ops';
import { connect, syncNow, type SyncServiceDeps } from '@/core/sync/service';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { itemSchema as shoppingSchema } from '@/modules/shopping/schema';
import { noteSchema } from '@/modules/notes/schema';
import { createTestDb } from '@/test-utils';
import { BASE_HLC, opsFor, runAppMigrations, type AppMigration } from './appMigrations';

/**
 * The runner against two real, unrelated tables: `shopping_item` (source, written by an "old
 * device") → `notes_note` (target). The concrete steps of a package are tested with their module.
 */
const SOURCE = tableName('shopping', 'item');
const TARGET = tableName('notes', 'note');

const step: AppMigration = {
  id: 'test-shopping-to-notes',
  source: SOURCE,
  target: TARGET,
  map: (row) => ({
    id: row.id,
    fields: { title: row.name, body: row.quantity ?? '', pinned: row.done === true },
    from: { title: 'name', body: 'quantity', pinned: 'done' },
  }),
};

interface Dev {
  db: TaschenmesserDB;
  source: ReturnType<typeof createRepo<{ name: string; quantity?: string; done: boolean }>>;
  target: ReturnType<typeof createRepo<{ title: string; body: string; pinned: boolean }>>;
  deps: SyncServiceDeps;
}
const dbs: TaschenmesserDB[] = [];
let clock = 1_800_000_000_000;
let server: MemoryServer;

function dev(): Dev {
  const db = createTestDb();
  dbs.push(db);
  const storage = new DexieStorageAdapter(db);
  return {
    db,
    source: createRepo(SOURCE, shoppingSchema, db),
    target: createRepo(TARGET, noteSchema, db) as unknown as Dev['target'],
    deps: { database: db, storage, remote: (_u, t) => server.remote(t), kdf: { m: 8, t: 1, p: 1 } },
  };
}
const run = (d: Dev, steps: readonly AppMigration[] = [step]) => runAppMigrations(d.db, { steps });
const outbox = (d: Dev) => d.db.table('_outbox').toArray();

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  server = new MemoryServer();
});
afterEach(async () => {
  setNow();
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('runAppMigrations', () => {
  it('does nothing for an empty source and for tables that do not exist', async () => {
    const d = dev();
    expect(await run(d)).toEqual([{ id: step.id, scanned: 0, copied: 0, skipped: 0 }]);
    const noTarget = { ...step, target: 'gone_table' };
    await d.source.create({ name: 'Milch', done: false });
    expect(await run(d, [noTarget])).toEqual([{ id: step.id, scanned: 0, copied: 0, skipped: 0 }]);
    const noSource = { ...step, source: 'gone_table' };
    expect(await run(d, [noSource])).toEqual([{ id: step.id, scanned: 0, copied: 0, skipped: 0 }]);
    expect(await d.target.table.count()).toBe(0);
  });

  it('copies rows with the same id, keeps the stamps of 1:1 fields and queues them for sync', async () => {
    const d = dev();
    const a = await d.source.create({ name: 'Milch', quantity: '2', done: false });
    const [report] = await run(d);
    expect(report).toMatchObject({ scanned: 1, copied: 1, skipped: 0 });

    const copy = (await d.target.table.get(a.id))!;
    expect(copy).toMatchObject({ title: 'Milch', body: '2', pinned: false, deletedAt: null });
    const src = (await d.source.table.get(a.id))!;
    expect(copy._f.title).toBe(src._f.name);
    expect(copy._f.body).toBe(src._f.quantity);
    expect(copy._f.pinned).toBe(src._f.done);
    expect((await outbox(d)).map((o) => o.collection)).toContain(TARGET);
    // The source stays untouched (no tombstone, no rewrite).
    expect(await d.source.table.get(a.id)).toEqual(src);
  });

  it('is idempotent: a second run changes nothing and queues nothing', async () => {
    const d = dev();
    await d.source.create({ name: 'Milch', done: false });
    await d.source.create({ name: 'Brot', done: true });
    await run(d);
    const rows = await d.target.table.toArray();
    const queued = await outbox(d);
    const [again] = await run(d);
    expect(again).toMatchObject({ scanned: 2, copied: 0 });
    expect(await d.target.table.toArray()).toEqual(rows);
    expect(await outbox(d)).toEqual(queued);
  });

  it('follows the source until the target is edited; a newer target edit always wins', async () => {
    const d = dev();
    const a = await d.source.create({ name: 'Milch', done: false });
    await run(d);
    await d.source.update(a.id, { name: 'Hafermilch' });
    await run(d);
    expect((await d.target.get(a.id))?.title).toBe('Hafermilch');

    await d.target.update(a.id, { title: 'Eigene Notiz' });
    await run(d);
    expect((await d.target.get(a.id))?.title).toBe('Eigene Notiz');
    // An older value of the source can never overwrite it, however often the runner runs.
    await d.source.update(a.id, { done: true });
    await run(d);
    expect(await d.target.get(a.id)).toMatchObject({ title: 'Eigene Notiz', pinned: true });
  });

  it('copies tombstones and never removes source rows', async () => {
    const d = dev();
    const a = await d.source.create({ name: 'Milch', done: false });
    await run(d);
    await d.source.remove(a.id);
    await run(d);
    expect(await d.target.get(a.id)).toBeUndefined();
    expect((await d.target.table.get(a.id))?.deletedAt).not.toBeNull();
    expect(await d.source.table.get(a.id)).toBeDefined();
  });

  it('skips rows the target schema rejects and rows the step maps to nothing', async () => {
    const d = dev();
    await d.source.create({ name: 'Milch', done: false });
    await d.source.create({ name: 'Leer', done: false });
    const picky: AppMigration = {
      ...step,
      map: (row) =>
        row.name === 'Leer'
          ? { id: row.id, fields: { title: '', body: '' } } // fails the "title or body" rule
          : row.name === 'Skip'
            ? undefined
            : step.map(row),
    };
    await d.source.create({ name: 'Skip', done: false });
    expect((await run(d, [picky]))[0]).toMatchObject({ scanned: 3, copied: 1, skipped: 2 });
  });

  it('makes up rows with BASE_HLC: identical everywhere, a user edit always wins', async () => {
    const d = dev();
    await d.source.create({ name: 'Milch', done: false });
    const withEnsure: AppMigration = {
      ...step,
      ensure: () => [
        { table: TARGET, id: 'fixed-note', fields: { title: 'Einkauf', body: '', pinned: false } },
      ],
    };
    await run(d, [withEnsure]);
    expect((await d.target.table.get('fixed-note'))?._f.title).toBe(BASE_HLC);
    await d.target.update('fixed-note', { title: 'Mein Einkauf' });
    const before = await outbox(d);
    await run(d, [withEnsure]);
    expect((await d.target.get('fixed-note'))?.title).toBe('Mein Einkauf');
    expect(await outbox(d)).toEqual(before);
  });

  it('survives concurrent calls (they are serialised)', async () => {
    const d = dev();
    await d.source.create({ name: 'Milch', done: false });
    const reports = await Promise.all([run(d), run(d), run(d)]);
    expect(reports.map((r) => r[0]!.copied).sort()).toEqual([0, 0, 1]);
    expect(await d.target.table.count()).toBe(1);
  });

  it('produces the same ops on every device for the same source row', async () => {
    const a = dev();
    const row = await a.source.create({ name: 'Milch', quantity: '2', done: false });
    const src = (await a.source.table.get(row.id)) as unknown as SyncRow;
    expect(opsFor(step, src)).toEqual(opsFor(step, JSON.parse(JSON.stringify(src))));
  });
});

describe('with sync: an old device writes the old table, a new device pulls', () => {
  const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

  it('the pull brings the old rows, the runner after syncNow puts them into the target', async () => {
    const oldDevice = dev();
    const newDevice = dev();
    const a = await oldDevice.source.create({ name: 'Milch', done: false });
    await runSync({ storage: oldDevice.deps.storage, adapter: server.adapter() });

    await connect(params, newDevice.deps);
    await syncNow(newDevice.deps);
    // `syncNow` runs the registered steps; the table copy is covered by the explicit run below.
    await runAppMigrations(newDevice.db, { steps: [step] });
    expect(await newDevice.target.get(a.id)).toMatchObject({ title: 'Milch' });

    // The old device edits the row later: the next pull + run updates the copy.
    await oldDevice.source.update(a.id, { name: 'Hafermilch' });
    await runSync({ storage: oldDevice.deps.storage, adapter: server.adapter() });
    await syncNow(newDevice.deps);
    await runAppMigrations(newDevice.db, { steps: [step] });
    expect((await newDevice.target.get(a.id))?.title).toBe('Hafermilch');
  });

  it('two new devices migrating the same rows converge without conflicts', async () => {
    const oldDevice = dev();
    const x = dev();
    const y = dev();
    const a = await oldDevice.source.create({ name: 'Milch', done: false });
    await runSync({ storage: oldDevice.deps.storage, adapter: server.adapter() });
    for (const d of [x, y]) {
      await runSync({ storage: d.deps.storage, adapter: server.adapter() });
      await runAppMigrations(d.db, { steps: [step] });
    }
    // Both push their copy and pull the other's: equal stamps, nothing changes, nothing conflicts.
    for (const d of [x, y, x, y])
      await runSync({ storage: d.deps.storage, adapter: server.adapter() });
    expect(await x.target.table.get(a.id)).toEqual(await y.target.table.get(a.id));
    expect(await x.db.table('_conflicts').count()).toBe(0);
    expect(await y.db.table('_conflicts').count()).toBe(0);
  });
});
