import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bus } from '@/core/events';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from '@/core/db/db';
import example from '@/modules/example/manifest';
import {
  disableModule,
  enableModule,
  loadModuleStates,
  resolveStates,
  wipeModuleData,
} from './activation';
import { runMigrations } from './migrate';
import type { ModuleManifest } from './types';

let db: TaschenmesserDB;
beforeEach(() => {
  db = createTestDb();
});
afterEach(async () => {
  bus.clear();
  db.close();
  await db.delete();
});

const entries = (d: TaschenmesserDB) =>
  createRepo(tableName('example', 'entry'), example.dataSchema.collections.entry!.schema, d);

describe('module activation', () => {
  it('falls back to defaultEnabled without an explicit choice', () => {
    const states = resolveStates(
      [
        { ...example, id: 'a', defaultEnabled: true },
        { ...example, id: 'b', defaultEnabled: false },
      ],
      [],
    );
    expect(states).toEqual({ a: true, b: false });
  });

  it('enable → explicit state wins over default and emits an event', async () => {
    const seen = vi.fn();
    bus.on('module.enabled', seen);
    await enableModule(example, db);
    expect((await loadModuleStates([example], db)).example).toBe(true);
    expect(seen).toHaveBeenCalledWith({ moduleId: 'example' });
  });

  it('disable with "keep" hides the module but retains its data', async () => {
    await enableModule(example, db);
    await entries(db).create({ title: 'keep me', done: false });
    await disableModule(example, 'keep', db);
    expect((await loadModuleStates([example], db)).example).toBe(false);
    expect(await entries(db).active().count()).toBe(1);
    await enableModule(example, db);
    expect(await entries(db).active().count()).toBe(1);
  });

  it('disable with "delete" writes tombstones and queues them for sync', async () => {
    await enableModule(example, db);
    const r = await entries(db).create({ title: 'bye', done: false });
    await db.table('_outbox').clear();
    await disableModule(example, 'delete', db);
    expect(await entries(db).active().count()).toBe(0);
    expect((await entries(db).table.get(r.id))?.deletedAt).not.toBeNull();
    expect(await db.table('_outbox').where('collection').equals('example_entry').count()).toBe(1);
  });

  it('wipeModuleData is safe on empty modules', async () => {
    await expect(wipeModuleData(example, db)).resolves.toBeUndefined();
  });
});

describe('module migrations', () => {
  const v2: ModuleManifest = {
    ...example,
    version: 2,
    migrations: {
      2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: `migrated:${String(r.title)}` })),
    },
  };

  it('treats a first-seen module as current and stores its version', async () => {
    await runMigrations(example, db);
    expect((await db.table('_meta').get('moduleVersion.example'))?.value).toBe(1);
  });

  it('runs pending migrations once and records the new version', async () => {
    await runMigrations(example, db); // installed = 1
    await entries(db).create({ title: 'a', done: false });
    await runMigrations(v2, db);
    const rows = await entries(db).active().toArray();
    expect(rows[0]?.note).toBe('migrated:a');
    // Second run must not re-apply.
    await entries(db).update(rows[0]!.id, { note: 'edited' });
    await runMigrations(v2, db);
    expect((await entries(db).active().toArray())[0]?.note).toBe('edited');
  });
});
