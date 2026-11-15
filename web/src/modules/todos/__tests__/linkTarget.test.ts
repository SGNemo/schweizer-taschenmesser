import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { LINK_KINDS, type LegacyLink } from '@/core/entitylinks/types';
import { db } from '@/core/db/db';
import target from '../linkTarget';
import source from '../plannable';
import { taskRepo } from '../repo';
import { taskLinkSchema, type TaskLink } from '../schema';

const base = { listId: 'inbox', done: false, priority: 0, order: 0 };

beforeEach(async () => {
  await db.table('todos_task').clear();
});

describe('ToDos as a link target', () => {
  it('alive: title, route and the task’s own `done`', async () => {
    const open = await taskRepo.create({ ...base, title: 'Antworten' });
    expect(await target.resolve(open.id)).toEqual({
      state: 'alive',
      title: 'Antworten',
      to: `/todos?open=${open.id}`,
      done: false,
    });
    const done = await taskRepo.create({ ...base, title: 'Fertig', done: true });
    expect(await target.resolve(done.id)).toMatchObject({ state: 'alive', done: true });
  });

  it('gone: a soft-deleted task and an id that was never here', async () => {
    const task = await taskRepo.create({ ...base, title: 'Weg' });
    await taskRepo.remove(task.id);
    expect(await target.resolve(task.id)).toEqual({ state: 'gone' });
    expect(await target.resolve('never-here')).toEqual({ state: 'gone' });
  });

  it('a malformed id is gone', async () => {
    expect(await target.resolve('x?open=<y>')).toEqual({ state: 'gone' });
    expect(await target.resolve('')).toEqual({ state: 'gone' });
  });
});

describe('the stored link shape stays what it was', () => {
  it('the Zod schema parses exactly the legacy link of core (no version step)', () => {
    expectTypeOf<z.output<typeof taskLinkSchema>>().toEqualTypeOf<LegacyLink>();
    expectTypeOf<TaskLink>().toEqualTypeOf<LegacyLink>();
    expect(taskLinkSchema.shape.kind.options).toEqual([...LINK_KINDS]);
    expect(Object.keys(taskLinkSchema.shape)).toEqual(['kind', 'id', 'label']);
    const link = { kind: 'mail', id: 't1', label: 'Betreff' };
    expect(taskLinkSchema.parse(link)).toEqual(link);
    expect(taskLinkSchema.safeParse({ ...link, kind: 'todo' }).success).toBe(false);
  });
});

describe('the planner source hands over every link', () => {
  it('`links` carries all of them in the contract shape; `link` stays the first', async () => {
    const links: TaskLink[] = [
      { kind: 'mail', id: 't1', label: 'Mahnung' },
      { kind: 'invoice', id: 'inv-1', label: 'Stadtwerke' },
    ];
    await taskRepo.create({ ...base, title: 'Bezahlen', links });
    await taskRepo.create({ ...base, title: 'Ohne' });
    const items = await source.list({ today: '2026-11-15', until: '2026-11-22' });
    const withLinks = items.find((i) => i.title === 'Bezahlen')!;
    expect(withLinks.link).toEqual(links[0]);
    expect(withLinks.links).toEqual([
      { to: { module: 'mail', id: 't1' }, rel: 'origin', label: 'Mahnung' },
      { to: { module: 'invoices', id: 'inv-1' }, rel: 'origin', label: 'Stadtwerke' },
    ]);
    const without = items.find((i) => i.title === 'Ohne')!;
    expect(without).not.toHaveProperty('link');
    expect(without).not.toHaveProperty('links');
  });
});
