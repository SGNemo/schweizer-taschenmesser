/**
 * Package 5b: the ToDo's deadline hour (`dueTime`) and its opt-in reminder (`dueRemind`). The shape step v6 is
 * lossless (old tasks parse as they were); the source hands the hour to the planner; a series keeps both.
 */
import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import manifest from '../manifest';
import { migrations } from '../migrations';
import plannable from '../plannable';
import { createNextInstance, taskRepo } from '../repo';
import { taskSchema } from '../schema';
import { readQuickAdd } from '../quickAdd';

const base = { listId: 'inbox', title: 'Steuer', done: false, priority: 0, order: 0 };

beforeEach(async () => {
  await db.table('todos_task').clear();
});

it('the shape step to v6 is recorded and lossless', async () => {
  expect(manifest.version).toBe(6);
  expect(Object.keys(migrations ?? {})).toContain('6');
  const old = { ...base, dueDate: '2026-11-15' };
  expect(taskSchema.parse(old)).toEqual(old);
  expect(taskSchema.parse({ ...old, dueTime: '18:00', dueRemind: true })).toMatchObject({
    dueTime: '18:00',
    dueRemind: true,
  });
  expect(() => taskSchema.parse({ ...old, dueTime: '25:00' })).toThrow();
  const saved = await taskRepo.create(old);
  await migrations![6]!({} as never);
  expect(await taskRepo.get(saved.id)).toMatchObject(old);
});

it('the planner source reports the hour with the soft due', async () => {
  await taskRepo.create({ ...base, dueDate: '2026-11-15', dueTime: '18:00' }, { id: 'a' });
  await taskRepo.create({ ...base, title: 'Ohne', dueDate: '2026-11-15' }, { id: 'b' });
  const items = await plannable.list({ today: '2026-11-14', until: '2026-11-20' });
  expect(items.find((i) => i.id === 'a')?.due).toEqual({
    date: '2026-11-15',
    hard: false,
    time: '18:00',
  });
  expect(items.find((i) => i.id === 'b')?.due).toEqual({ date: '2026-11-15', hard: false });
});

it('a series keeps the hour and the reminder on the next instance', async () => {
  const task = await taskRepo.create({
    ...base,
    dueDate: '2026-11-15',
    dueTime: '18:00',
    dueRemind: true,
    recurrence: { freq: 'weekly', interval: 1 },
  });
  await createNextInstance(task);
  const next = (await taskRepo.active().toArray()).find((x) => x.id !== task.id)!;
  expect(next).toMatchObject({ dueDate: '2026-11-22', dueTime: '18:00', dueRemind: true });
});

it('the ToDo page line „… bis So 18:00“ keeps the hour as the deadline, a plain time stays a note', () => {
  const now = new Date(2026, 9, 29, 10, 0);
  expect(readQuickAdd('Team-Sachen lesen bis So 18:00', now)).toMatchObject({
    title: 'Team-Sachen lesen',
    dueDate: '2026-11-01',
    dueTime: '18:00',
  });
  expect(readQuickAdd('Team-Sachen lesen bis So 18:00', now).note).toBeUndefined();
  expect(readQuickAdd('Mama anrufen Fr 18:00', now)).toMatchObject({ note: 'Uhrzeit: 18:00' });
});
