import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRepo, type Repo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import {
  forgetUndo,
  resetUndoJournal,
  UNDO_LIMIT,
  undoDepth,
  undoEntry,
  undoLast,
  undoable,
  UndoReplayError,
} from './index';
import { recordAs } from '@/core/db/recorder';

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
  it('forgetUndo drops the entries of one scope and keeps the rest', async () => {
    const a = await undoable('Plan', () => repo.create({ title: 'a', done: false }), 'planner');
    await undoable('Neu', () => repo.create({ title: 'b', done: false }));
    forgetUndo('planner');
    expect(undoDepth()).toBe(1);
    expect(await undoEntry(a.entry!.id)).toBe(false);
    expect(await repo.get(a.result.id)).toBeDefined();
    expect(await undoLast()).toBe('Neu');
  });

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

describe('an action with its own inverse (planner hub 2, package 4a)', () => {
  it('replaces the recorded steps of that action only; a nested call keeps the outer steps', async () => {
    const calls: string[] = [];
    const a = await repo.create({ title: 'A', done: false });
    const { entry } = await undoable(
      'own',
      () => repo.update(a.id, { title: 'B' }),
      undefined,
      async () => void calls.push('inverse'),
    );
    expect(entry?.steps).toHaveLength(1);
    await undoLast();
    // The own inverse ran; the recorded restore of the field did not.
    expect(calls).toEqual(['inverse']);
    expect((await repo.get(a.id))?.title).toBe('B');
    // Nothing written: no entry.
    const none = await undoable(
      'none',
      async () => undefined,
      undefined,
      async () => undefined,
    );
    expect(none.entry).toBeUndefined();
    // Nested: part of the outer action, with the outer recorded steps.
    await undoable('outer', () =>
      undoable(
        'inner',
        () => repo.update(a.id, { title: 'C' }),
        undefined,
        async () => {
          calls.push('x');
        },
      ),
    );
    await undoLast();
    expect((await repo.get(a.id))?.title).toBe('B');
    expect(calls).toEqual(['inverse']);
  });
});

describe('an action that throws takes its writes back', () => {
  it('a throw after two writes leaves nothing, rethrows the error and keeps no entry', async () => {
    const before = await repo.create({ title: 'before', done: false });
    let made: string | undefined;
    const boom = new Error('boom');
    await expect(
      undoable('Zwei', async () => {
        made = (await repo.create({ title: 'neu', done: false })).id;
        await repo.update(before.id, { done: true, note: 'x' });
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(await repo.get(made!)).toBeUndefined();
    const back = await repo.get(before.id);
    expect(back?.done).toBe(false);
    expect(back?.note).toBeUndefined();
    expect(undoDepth()).toBe(0);
    // The rollback's own writes were not recorded: the next action starts clean.
    const { entry } = await undoable('Danach', () => repo.create({ title: 'n', done: false }));
    expect(entry?.steps).toHaveLength(1);
  });

  it('replays newest first', async () => {
    const x = await repo.create({ title: 'x', done: false });
    const order: number[] = [];
    await expect(
      undoable('Reihenfolge', async () => {
        for (const n of [1, 2, 3])
          await recordAs(
            async () => void order.push(n),
            () => repo.update(x.id, { title: `t${n}` }),
          );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(order).toEqual([3, 2, 1]);
  });

  it('a nested throw rolls back the whole outer action; one the outer fn catches rolls nothing back', async () => {
    let outerId: string | undefined;
    let innerId: string | undefined;
    await expect(
      undoable('Außen', async () => {
        outerId = (await repo.create({ title: 'o', done: false })).id;
        await undoable('Innen', async () => {
          innerId = (await repo.create({ title: 'i', done: false })).id;
          throw new Error('inner');
        });
      }),
    ).rejects.toThrow('inner');
    expect(await repo.get(outerId!)).toBeUndefined();
    expect(await repo.get(innerId!)).toBeUndefined();
    expect(undoDepth()).toBe(0);

    const { entry } = await undoable('Außen', async () => {
      outerId = (await repo.create({ title: 'o', done: false })).id;
      await undoable('Innen', async () => {
        innerId = (await repo.create({ title: 'i', done: false })).id;
        throw new Error('inner');
      }).catch(() => undefined);
    });
    // Part of the outer action as before: both stay, and one undo takes both back.
    expect(await repo.get(innerId!)).toBeDefined();
    expect(entry?.steps).toHaveLength(2);
    await undoLast();
    expect(await repo.get(outerId!)).toBeUndefined();
    expect(await repo.get(innerId!)).toBeUndefined();
  });

  it('a step of the rollback that fails is reported as UndoReplayError and the others still run', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const b = await repo.create({ title: 'b', done: false });
    const boom = new Error('boom');
    const failed = new Error('step');
    const err = await undoable('Zwei', async () => {
      await repo.update(a.id, { done: true });
      await recordAs(
        async () => {
          throw failed;
        },
        () => repo.update(b.id, { done: true }),
      );
      throw boom;
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UndoReplayError);
    expect((err as UndoReplayError).cause).toBe(boom);
    expect((err as UndoReplayError).failures).toEqual([failed]);
    expect((err as UndoReplayError).message).not.toContain('Zwei');
    expect((await repo.get(a.id))?.done).toBe(false); // the other step still ran
    expect((await repo.get(b.id))?.done).toBe(true); // the failed one stays
    expect(undoDepth()).toBe(0);
  });

  it('recordAs records its inverse also when its fn throws after the write', async () => {
    const a = await repo.create({ title: 'a', done: false });
    const calls: string[] = [];
    await expect(
      undoable('Eigen', () =>
        recordAs(
          async () => void calls.push('inverse'),
          async () => {
            await repo.update(a.id, { done: true });
            throw new Error('after');
          },
        ),
      ),
    ).rejects.toThrow('after');
    expect(calls).toEqual(['inverse']);
  });
});
