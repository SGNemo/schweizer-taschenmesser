import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setDone, taskRepo } from '../repo';

beforeEach(async () => {
  await db.table('todos_task').clear();
});

const base = { listId: 'inbox', done: false, priority: 1, order: 0 };

// QA round 4, X05: reopening tombstones the next instance (fixed id); ticking off again must bring
// it back, otherwise the series ends.
it('tick, reopen, tick again keeps the series going (with its subtasks)', async () => {
  const t = await taskRepo.create({
    ...base,
    title: 'Blumen gießen',
    dueDate: '2026-11-05',
    recurrence: { freq: 'weekly', interval: 1 },
  });
  await taskRepo.create({ ...base, title: 'Balkon', parentId: t.id });
  await setDone(t, true);
  await setDone((await taskRepo.get(t.id))!, false);
  await setDone((await taskRepo.get(t.id))!, true);

  const next = await taskRepo.get(`${t.id}:2026-11-12`);
  expect(next).toMatchObject({ done: false, dueDate: '2026-11-12' });
  const subs = (await taskRepo.active().toArray()).filter((s) => s.parentId === next?.id);
  expect(subs.map((s) => s.title)).toEqual(['Balkon']);
});

it('ticking off again after a fix in between carries the fixed values to the next instance', async () => {
  const t = await taskRepo.create({
    ...base,
    title: 'Blumen gieen',
    dueDate: '2026-11-05',
    recurrence: { freq: 'weekly', interval: 1 },
  });
  await setDone(t, true);
  await setDone((await taskRepo.get(t.id))!, false);
  await taskRepo.update(t.id, { title: 'Blumen gießen', priority: 3 });
  await setDone((await taskRepo.get(t.id))!, true);
  expect(await taskRepo.get(`${t.id}:2026-11-12`)).toMatchObject({
    title: 'Blumen gießen',
    priority: 3,
    done: false,
  });
});

it('a subtask whose due date was removed in between comes back without one', async () => {
  const t = await taskRepo.create({
    ...base,
    title: 'Steuer',
    dueDate: '2026-11-05',
    recurrence: { freq: 'weekly', interval: 1 },
  });
  const sub = await taskRepo.create({
    ...base,
    title: 'Belege',
    parentId: t.id,
    dueDate: '2026-11-04',
  });
  await setDone(t, true);
  await setDone((await taskRepo.get(t.id))!, false);
  await taskRepo.update(sub.id, { dueDate: undefined });
  await setDone((await taskRepo.get(t.id))!, true);
  const copy = (await taskRepo.active().toArray()).find((x) => x.parentId === `${t.id}:2026-11-12`);
  expect(copy?.title).toBe('Belege');
  expect(copy?.dueDate).toBeUndefined();
});
