import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import source from '../notifications';
import { taskRepo } from '../repo';

const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const range = { from: toEpoch('2026-10-05', '00:00'), to: toEpoch('2026-10-07', '00:00') };

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('_settings').clear();
});

describe('todos morning digest', () => {
  it('one soft notification per day that lists the ToDos due or planned for it', async () => {
    await taskRepo.create({ ...base, title: 'Steuer', dueDate: '2026-10-05', order: 1 });
    await taskRepo.create({ ...base, title: 'Wäsche', plannedFor: '2026-10-05', order: 2 });
    await taskRepo.create({ ...base, title: 'Später', dueDate: '2026-10-06' });
    await taskRepo.create({ ...base, title: 'Erledigt', dueDate: '2026-10-05', done: true });
    await taskRepo.create({ ...base, title: 'Irgendwann', dueDate: '2026-10-05', someday: true });
    const out = await source(range);
    expect(out.map((n) => [n.key, n.title, n.body, n.soft])).toEqual([
      ['todos:digest:2026-10-05', 'Heute: 2 ToDos', 'Steuer · Wäsche', true],
      ['todos:digest:2026-10-06', 'Heute: 1 ToDo', 'Später', true],
    ]);
    expect(out[0]!.at).toBe(toEpoch('2026-10-05', '09:00'));
  });

  it('shortens long lists and is silent on empty days', async () => {
    for (const [i, title] of ['A', 'B', 'C', 'D'].entries())
      await taskRepo.create({ ...base, title, dueDate: '2026-10-05', order: i });
    const [first] = await source(range);
    expect(first!.body).toBe('A · B · C …');
    expect(
      await source({ from: toEpoch('2026-10-07', '00:00'), to: toEpoch('2026-10-09', '00:00') }),
    ).toEqual([]);
  });

  it('can be switched off and moved', async () => {
    await taskRepo.create({ ...base, title: 'X', dueDate: '2026-10-05' });
    await patchFocusSettings({ todoDigestTime: '07:30' });
    expect((await source(range))[0]!.at).toBe(toEpoch('2026-10-05', '07:30'));
    await patchFocusSettings({ todoDigest: false });
    expect(await source(range)).toEqual([]);
  });
});
