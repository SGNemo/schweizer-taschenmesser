import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRepo, type Repo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { resetUndoJournal, UNDO_LIMIT, undoDepth, undoEntry, undoLast, undoable } from './index';

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
  setNow(() => (clock += 1000));
  db = createTestDb();
  repo = createRepo('example_entry', schema, db);
  resetUndoJournal();
});
afterEach(async () => {
  resetUndoJournal();
  setNow();
  db.close();
  await db.delete();
});

describe('undo journal', () => {
  it('undoes a create by tombstoning the record', async () => {
    const { result } = await undoable('Neu', () => repo.create({ title: 'a', done: false }));
    expect(await repo.get(result.id)).toBeDefined();
    expect(await undoLast()).toBe('Neu');
    expect(await repo.get(result.id)).toBeUndefined();
  });

  it('undoes an update by restoring the previous field values, also removed ones', async () => {
    const r = await repo.create({ title: 'a', done: false, note: 'x' });
    await undoable('Ändern', () => repo.update(r.id, { done: true, note: undefined }));
    expect((await repo.get(r.id))?.done).toBe(true);
    expect((await repo.get(r.id))?.note).toBeUndefined();
    await undoLast();
    const back = await repo.get(r.id);
    expect(back?.done).toBe(false);
    expect(back?.note).toBe('x');
  });

  it('undoes removals and restores, and many removals as one action', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const b = await repo.create({ title: 'b', done: false });
    await undoable('Löschen', () => repo.removeMany([a.id, b.id]));
    expect(await repo.get(a.id)).toBeUndefined();
    await undoLast();
    expect(await repo.get(a.id)).toBeDefined();
    expect(await repo.get(b.id)).toBeDefined();
    expect(undoDepth()).toBe(0);
  });

  it('undoes an upsert: replaces with the old data, or removes a new record', async () => {
    const r = await repo.create({ title: 'a', done: false });
    await undoable('Upsert', () => repo.upsert(r.id, { title: 'neu', done: true }));
    await undoLast();
    expect((await repo.get(r.id))?.title).toBe('a');

    await undoable('Upsert neu', () => repo.upsert('fixed', { title: 'n', done: false }));
    expect(await repo.get('fixed')).toBeDefined();
    await undoLast();
    expect(await repo.get('fixed')).toBeUndefined();
  });

  it('one action with several writes is undone in reverse order', async () => {
    const entry = await undoable('Mehrere', async () => {
      const x = await repo.create({ title: 'x', done: false });
      await repo.update(x.id, { title: 'y' });
      return x;
    });
    await undoLast();
    expect(await repo.get(entry.result.id)).toBeUndefined();
  });

  it('writes outside undoable() and writes after it has resolved are not recorded', async () => {
    await repo.create({ title: 'outside', done: false });
    expect(undoDepth()).toBe(0);
    const { entry } = await undoable('Nur lesen', async () => 1);
    expect(entry).toBeUndefined();
    await repo.create({ title: 'later', done: false });
    expect(undoDepth()).toBe(0);
  });

  it('keeps the last ten actions only and says when there is nothing to undo', async () => {
    for (let i = 0; i < UNDO_LIMIT + 3; i++)
      await undoable(`A${i}`, () => repo.create({ title: `t${i}`, done: false }));
    expect(undoDepth()).toBe(UNDO_LIMIT);
    expect(await undoLast()).toBe(`A${UNDO_LIMIT + 2}`);
    resetUndoJournal();
    expect(await undoLast()).toBeUndefined();
  });

  it('a step that fails (record deleted meanwhile) does not stop the others and reports false', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const b = await repo.create({ title: 'b', done: false });
    const { entry } = await undoable('Zwei', async () => {
      await repo.update(a.id, { done: true });
      await repo.update(b.id, { done: true });
    });
    await repo.remove(a.id); // the first update can no longer be undone
    expect(await undoEntry(entry!.id)).toBe(false);
    expect((await repo.get(b.id))?.done).toBe(false);
  });

  it('nested undoable() joins the outer action', async () => {
    await undoable('Außen', async () => {
      await undoable('Innen', () => repo.create({ title: 'n', done: false }));
    });
    expect(undoDepth()).toBe(1);
  });
});
