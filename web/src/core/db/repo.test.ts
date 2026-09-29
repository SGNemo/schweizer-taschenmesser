import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from './db';
import { createRepo, type Repo } from './repo';

const schema = z.object({
  title: z.string().min(1),
  done: z.boolean().default(false),
  note: z.string().optional(),
});

let db: TaschenmesserDB;
let repo: Repo<z.output<typeof schema>>;
let clock: number;

beforeEach(() => {
  clock = 1_700_000_000_000;
  setNow(() => clock);
  db = createTestDb();
  repo = createRepo('example_entry', schema, db);
});
afterEach(async () => {
  setNow();
  db.close();
  await db.delete();
});

describe('createRepo', () => {
  it('creates records with envelope and per-field stamps', async () => {
    const r = await repo.create({ title: 'a', done: false });
    expect(r.id).toBeTruthy();
    expect(r.deletedAt).toBeNull();
    expect(r.createdAt).toBe(clock);
    expect(r.deviceId).toMatch(/^[a-z0-9]{8}$/);
    expect(Object.keys(r._f).sort()).toEqual(['deletedAt', 'done', 'title']);
    expect((await repo.get(r.id))?.title).toBe('a');
  });

  it('rejects invalid data', async () => {
    await expect(repo.create({ title: '', done: false })).rejects.toThrow();
  });

  it('only stamps fields that actually changed', async () => {
    const r = await repo.create({ title: 'a', done: false });
    clock += 1000;
    const u = await repo.update(r.id, { done: true });
    expect(u._f.title).toBe(r._f.title);
    expect(u._f.done! > r._f.done!).toBe(true);
    expect(u.updatedAt).toBe(clock);
    expect(u.createdAt).toBe(r.createdAt);
  });

  it('is a no-op (no new stamp, no outbox write) when nothing changed', async () => {
    const r = await repo.create({ title: 'a', done: false });
    await db.table('_outbox').clear();
    const u = await repo.update(r.id, { title: 'a' });
    expect(u._f).toEqual(r._f);
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('keeps new stamps monotonic even if the wall clock moved backwards', async () => {
    const r = await repo.create({ title: 'a', done: false });
    clock -= 10 * 60_000;
    const u = await repo.update(r.id, { title: 'b' });
    expect(u._f.title! > r._f.title!).toBe(true);
  });

  it('soft-deletes into a tombstone and hides it from reads', async () => {
    const r = await repo.create({ title: 'a', done: false });
    clock += 5;
    await repo.remove(r.id);
    expect(await repo.get(r.id)).toBeUndefined();
    expect(await repo.active().count()).toBe(0);
    const raw = await repo.table.get(r.id);
    expect(raw!.deletedAt).toBe(clock);
    expect(raw!._f.deletedAt! > r._f.deletedAt!).toBe(true);
  });

  it('cannot update a deleted record, but can restore it', async () => {
    const r = await repo.create({ title: 'a', done: false });
    await repo.remove(r.id);
    await expect(repo.update(r.id, { title: 'x' })).rejects.toThrow(/not found/);
    await repo.restore(r.id);
    expect((await repo.get(r.id))?.title).toBe('a');
  });

  it('upsert creates with a fixed id, then replaces data', async () => {
    const a = await repo.upsert('fixed', { title: 'one', done: false });
    expect(a.id).toBe('fixed');
    clock += 1;
    const b = await repo.upsert('fixed', { title: 'two', done: false });
    expect(b.title).toBe('two');
    expect(await repo.active().count()).toBe(1);
  });

  it('queues every changed record in the outbox', async () => {
    const r = await repo.create({ title: 'a', done: false });
    await repo.update(r.id, { done: true });
    await repo.remove(r.id);
    const rows = await db.table('_outbox').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ collection: 'example_entry', id: r.id });
  });

  it('removeMany tombstones all given ids', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const b = await repo.create({ title: 'b', done: false });
    await repo.removeMany([a.id, b.id]);
    expect(await repo.active().count()).toBe(0);
  });

  it('persists one device id per database', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const b = await repo.create({ title: 'b', done: false });
    expect(a.deviceId).toBe(b.deviceId);
  });
});
