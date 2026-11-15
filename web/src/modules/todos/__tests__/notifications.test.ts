import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import { describeCollection } from '@/core/dataapi/format';
import manifest from '../manifest';
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

describe('deadline reminder „Erinnern: 1 Std vorher“ (package 5b)', () => {
  const due = { ...base, title: 'Team-Sachen lesen', dueDate: '2026-10-05', dueTime: '18:00' };
  beforeEach(() => setNow(() => toEpoch('2026-10-05', '08:00')));
  afterEach(() => setNow());
  const reminders = async (r = range) =>
    (await source(r)).filter((n) => n.key.startsWith('todos:due:'));

  it('off by default: a deadline with an hour alone sends nothing', async () => {
    await taskRepo.create(due);
    expect(await reminders()).toEqual([]);
  });

  it('switched on: one notification an hour before, set by the user (not soft), opening the task', async () => {
    const task = await taskRepo.create({ ...due, dueRemind: true });
    const out = await reminders();
    expect(out).toEqual([
      {
        key: `todos:due:${task.id}:2026-10-05T18:00`,
        at: toEpoch('2026-10-05', '17:00'),
        title: 'Bis 18:00: Team-Sachen lesen',
        body: 'Die Frist ist in einer Stunde.',
        url: `/todos?open=${task.id}`,
      },
    ]);
    expect(out[0]!.soft).toBeUndefined();
  });

  it('exactly once: a later window does not repeat it', async () => {
    await taskRepo.create({ ...due, dueRemind: true });
    const at = toEpoch('2026-10-05', '17:00');
    expect(await reminders({ from: range.from, to: at })).toHaveLength(1);
    expect(await reminders({ from: at, to: range.to })).toEqual([]);
  });

  it('done, deleted or moved: nothing for the old deadline', async () => {
    const a = await taskRepo.create({ ...due, title: 'A', dueRemind: true });
    const b = await taskRepo.create({ ...due, title: 'B', dueRemind: true });
    const c = await taskRepo.create({ ...due, title: 'C', dueRemind: true });
    await taskRepo.update(a.id, { done: true });
    await taskRepo.remove(b.id);
    await taskRepo.update(c.id, { dueDate: '2026-10-08' });
    expect(await reminders()).toEqual([]);
    // The moved deadline has its own reminder (a new key), on its own day.
    const later = await reminders({
      from: toEpoch('2026-10-08', '00:00'),
      to: toEpoch('2026-10-09', '00:00'),
    });
    expect(later.map((n) => n.key)).toEqual([`todos:due:${c.id}:2026-10-08T18:00`]);
  });

  it('without an hour there is none, and the morning digest switch does not touch it', async () => {
    await taskRepo.create({ ...due, title: 'Ohne Uhrzeit', dueTime: undefined, dueRemind: true });
    await taskRepo.create({ ...due, dueRemind: true });
    await patchFocusSettings({ todoDigest: false });
    const out = await source(range);
    expect(out.map((n) => n.title)).toEqual(['Bis 18:00: Team-Sachen lesen']);
  });

  it('a catch-up after the deadline has passed sends nothing („in einer Stunde“ would be wrong)', async () => {
    await taskRepo.create({ ...due, dueRemind: true });
    setNow(() => toEpoch('2026-10-05', '18:30'));
    expect(await reminders()).toEqual([]);
  });

  it('the opt-in is not part of the import format: no AI or API switches it on in bulk', () => {
    const format = describeCollection(manifest, 'task');
    expect(format.internal).toContain('dueRemind');
    expect(format.fields.map((f) => f.name)).toContain('dueTime');
  });
});
