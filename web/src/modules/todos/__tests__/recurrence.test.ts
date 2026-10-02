import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems } from '@/core/modules/contributions';
import manifest from '../manifest';
import { setDone, taskRepo } from '../repo';

beforeEach(async () => {
  await db.table('todos_task').clear();
});

const weekly = { freq: 'weekly', interval: 1 } as const;
const base = { listId: 'inbox', done: false, priority: 1, order: 0 };

describe('recurring tasks', () => {
  it('ticking off keeps the task and creates the next instance once', async () => {
    const t = await taskRepo.create({
      ...base,
      title: 'Müll rausbringen',
      dueDate: '2026-10-05',
      recurrence: weekly,
      note: 'Dienstag',
    });
    await setDone(t, true);
    await setDone((await taskRepo.get(t.id))!, true); // again (second device, double tap)
    const all = await taskRepo.active().toArray();
    expect(all.map((x) => [x.id, x.done, x.dueDate]).sort()).toEqual([
      [t.id, true, '2026-10-05'],
      [`${t.id}:2026-10-12`, false, '2026-10-12'],
    ]);
    const next = all.find((x) => x.id.includes(':'))!;
    expect(next).toMatchObject({
      title: 'Müll rausbringen',
      priority: 1,
      note: 'Dienstag',
      recurrence: weekly,
      listId: 'inbox',
    });
    // The chain continues from the new instance without growing the id.
    await setDone(next, true);
    expect((await taskRepo.get(`${t.id}:2026-10-19`))?.dueDate).toBe('2026-10-19');
  });

  it('reopening removes the open next instance again', async () => {
    const t = await taskRepo.create({
      ...base,
      title: 'A',
      dueDate: '2026-10-05',
      recurrence: weekly,
    });
    await setDone(t, true);
    await setDone((await taskRepo.get(t.id))!, false);
    expect((await taskRepo.active().toArray()).map((x) => x.id)).toEqual([t.id]);
  });

  it('a task without recurrence just toggles', async () => {
    const t = await taskRepo.create({ ...base, title: 'B', dueDate: '2026-10-05' });
    await setDone(t, true);
    expect(await taskRepo.active().count()).toBe(1);
    expect((await taskRepo.get(t.id))?.done).toBe(true);
  });

  it('shows later occurrences of an open recurring task on the calendar, not "Irgendwann" ones', async () => {
    await taskRepo.create({ ...base, title: 'Müll', dueDate: '2026-10-05', recurrence: weekly });
    await taskRepo.create({ ...base, title: 'Später', dueDate: '2026-10-07', someday: true });
    const items = await collectCalendarItems({ from: '2026-10-01', to: '2026-10-20' }, [manifest]);
    expect(items.map((i) => [i.date, i.title]).sort()).toEqual([
      ['2026-10-05', 'Müll'],
      ['2026-10-12', 'Müll'],
      ['2026-10-19', 'Müll'],
    ]);
  });

  it('copies the subtasks into the next instance (open again) and removes them on reopen', async () => {
    const t = await taskRepo.create({
      ...base,
      title: 'Putzen',
      dueDate: '2026-10-05',
      recurrence: weekly,
    });
    const bad = await taskRepo.create({ ...base, title: 'Bad', parentId: t.id, done: true });
    await taskRepo.create({ ...base, title: 'Küche', parentId: t.id, dueDate: '2026-10-06' });
    await setDone(t, true);
    await setDone((await taskRepo.get(t.id))!, true); // a second run adds nothing
    const nextId = `${t.id}:2026-10-12`;
    const subs = (await taskRepo.active().toArray()).filter((x) => x.parentId === nextId);
    expect(subs.map((x) => [x.title, x.done, x.dueDate]).sort()).toEqual([
      ['Bad', false, undefined],
      ['Küche', false, '2026-10-13'],
    ]);
    expect(subs.find((x) => x.title === 'Bad')!.id).toBe(`${bad.id}:2026-10-12`);
    // The originals stay as they were.
    expect((await taskRepo.get(bad.id))?.done).toBe(true);

    await setDone((await taskRepo.get(t.id))!, false);
    expect((await taskRepo.active().toArray()).filter((x) => x.id.includes(':'))).toEqual([]);
  });
});
