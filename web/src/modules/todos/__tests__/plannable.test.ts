import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsOf } from '@/core/automation/ingest';
import { createJsonRuntime } from '@/core/dataapi/importer';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { automation } from '../automation';
import manifest from '../manifest';
import { dayPlan } from '../next';
import { cleanupPlanMarks, restorePatch } from '../planMark';
import source, { assignPatch } from '../plannable';
import { postponePatch } from '../postpone';
import { listRepo, taskRepo } from '../repo';
import { isPlannerOwned, movePatch, userPlannedFor } from '../views';

const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const own = (date: string, order = 0, prior?: string) => ({
  plannedFor: date,
  planMark: { date, order, ...(prior ? { prior } : {}) },
});

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of ['todos_task', 'todos_list', '_modules', '_meta', '_secrets', '_outbox'])
    await db.table(t).clear();
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
});
afterEach(() => setNow());

describe('ownership: planner-own only while the mark carries the date', () => {
  it('reads every other combination as the user’s date (both LWW interleavings, an unlisted writer)', () => {
    expect(isPlannerOwned(own('2026-11-12'))).toBe(true);
    // Interleaving 1: the user's plannedFor won the merge, the planner's mark too.
    expect(isPlannerOwned({ plannedFor: '2026-11-10', planMark: { date: '2026-11-12', order: 0 } })).toBe(false);
    // Interleaving 2: the planner's plannedFor won, the user's cleared mark too.
    expect(isPlannerOwned({ plannedFor: '2026-11-12' })).toBe(false);
    // An unlisted writer set the date without touching the mark: stale mark, user's date.
    const task = { ...own('2026-11-12'), plannedFor: '2026-11-20' };
    expect(isPlannerOwned(task)).toBe(false);
    expect(assignPatch(task, undefined, undefined, TODAY)).toEqual({ planMark: undefined });
  });

  it('userPlannedFor clears the mark only when the date really changes', () => {
    const task = own('2026-11-12', 1, '2026-11-10');
    expect(userPlannedFor(task, '2026-11-12')).toEqual({}); // a title-only save keeps it
    expect(userPlannedFor(task, '2026-11-13')).toEqual({ plannedFor: '2026-11-13', planMark: undefined });
    expect(userPlannedFor(task, undefined)).toEqual({ plannedFor: undefined, planMark: undefined });
    expect(userPlannedFor({ plannedFor: '2026-11-13' }, '2026-11-14')).toEqual({ plannedFor: '2026-11-14' });
    // Every ToDo-side writer goes through it: „Später“ and the board move clear the mark with the date.
    expect(postponePatch(own(TODAY), TODAY)).toEqual({ plannedFor: '2026-11-10', planMark: undefined });
    expect(movePatch({ done: false, ...own('2026-11-12') }, 'today', TODAY)).toMatchObject({
      plannedFor: TODAY,
      planMark: undefined,
    });
    expect(movePatch({ done: false, ...own('2026-11-12') }, 'someday', TODAY)).toMatchObject({
      someday: true,
      plannedFor: undefined,
      planMark: undefined,
    });
  });
});

describe('assignPatch (onAssign)', () => {
  it('writes date and mark only on a change and keeps the user’s date in `prior`', () => {
    expect(assignPatch({ plannedFor: '2026-11-10' }, '2026-11-12', 0, TODAY)).toEqual({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', order: 0, prior: '2026-11-10' },
    });
    expect(assignPatch({}, '2026-11-12', 2, TODAY)).toEqual({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', order: 2 },
    });
    // Planner-own: the prior travels along, a re-assignment of the same thing writes nothing.
    const t = own('2026-11-12', 1, '2026-11-10');
    expect(assignPatch(t, '2026-11-12', 1, TODAY)).toEqual({});
    expect(assignPatch(t, '2026-11-13', 0, TODAY)).toEqual({
      plannedFor: '2026-11-13',
      planMark: { date: '2026-11-13', order: 0, prior: '2026-11-10' },
    });
    // The user's date equals the planner's: the mark is set, the prior is that date.
    expect(assignPatch({ plannedFor: '2026-11-12' }, '2026-11-12', 0, TODAY)).toEqual({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', order: 0, prior: '2026-11-12' },
    });
  });

  it('undefined on a planner-own value clears it and writes `prior` back unless it is in the past', () => {
    expect(assignPatch(own('2026-11-12', 0, '2026-11-10'), undefined, undefined, TODAY)).toEqual({
      plannedFor: '2026-11-10',
      planMark: undefined,
    });
    expect(assignPatch(own('2026-11-12', 0, '2026-11-01'), undefined, undefined, TODAY)).toEqual({
      plannedFor: undefined,
      planMark: undefined,
    });
    expect(assignPatch(own('2026-11-12'), undefined, undefined, TODAY)).toEqual({
      plannedFor: undefined,
      planMark: undefined,
    });
    // On a user's date: only a stale mark goes, the date stays.
    expect(assignPatch({ plannedFor: '2026-11-10' }, undefined, undefined, TODAY)).toEqual({});
  });

  it('a missing order clears the mark', () => {
    expect(assignPatch(own('2026-11-12'), '2026-11-12', undefined, TODAY)).toEqual({ planMark: undefined });
    expect(assignPatch({}, '2026-11-12', undefined, TODAY)).toEqual({ plannedFor: '2026-11-12' });
  });
});

describe('the source', () => {
  it('lists open top-level tasks that are not „Irgendwann“, with the planner’s fields', async () => {
    const a = await taskRepo.create({
      ...base,
      title: 'Steuer',
      estimateMin: 120,
      priority: 2,
      dueDate: '2026-11-12',
      startDate: '2026-11-10',
      ...own('2026-11-11', 0),
    });
    await taskRepo.create({ ...base, title: 'erledigt', done: true });
    await taskRepo.create({ ...base, title: 'irgendwann', someday: true });
    await taskRepo.create({ ...base, title: 'Schritt', parentId: a.id });
    const items = await source.list({ today: TODAY, until: '2026-11-15' });
    expect(items).toEqual([
      {
        id: a.id,
        kind: 'task',
        title: 'Steuer',
        to: `/todos?open=${a.id}`,
        durationMin: 120,
        priority: 2,
        due: { date: '2026-11-12', hard: false },
        earliest: '2026-11-10',
        plannedFor: '2026-11-11',
        planMark: { date: '2026-11-11', order: 0 },
      },
    ]);
  });

  it('onAssign, onDone and onEstimate write through the repo; unchanged values write nothing', async () => {
    const a = await taskRepo.create({ ...base, title: 'A', plannedFor: '2026-11-10' });
    await source.onAssign!(a.id, '2026-11-12', 1);
    const stamped = (await taskRepo.get(a.id))!;
    expect(stamped).toMatchObject({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', order: 1, prior: '2026-11-10' },
    });
    await source.onAssign!(a.id, '2026-11-12', 1);
    expect((await taskRepo.get(a.id))!.updatedAt).toBe(stamped.updatedAt);
    await source.onAssign!(a.id, undefined);
    expect(await taskRepo.get(a.id)).toMatchObject({ plannedFor: '2026-11-10' });
    expect((await taskRepo.get(a.id))!.planMark).toBeUndefined();
    await source.onEstimate!(a.id, 45);
    expect((await taskRepo.get(a.id))!.estimateMin).toBe(45);
    await source.onDone!(a.id);
    expect((await taskRepo.get(a.id))!.done).toBe(true);
    expect(await source.list({ today: TODAY, until: '2026-11-15' })).toEqual([]);
  });
});

describe('the „Heute“ card', () => {
  it('lists marked things first in the plan’s order, then the rest; a stale mark never sorts', () => {
    const t = (id: string, over: Record<string, unknown>) =>
      ({ id, createdAt: 1, done: false, priority: 0, order: 0, ...over }) as never;
    const tasks = [
      t('user', { plannedFor: TODAY, order: 0 }),
      t('second', { ...own(TODAY, 1), order: 5 }),
      t('first', { ...own(TODAY, 0), order: 9 }),
      t('stale', { plannedFor: TODAY, planMark: { date: '2026-11-01', order: 0 }, order: 1 }),
    ];
    expect(dayPlan(tasks, TODAY, 5).planned.map((x: { id: string }) => x.id)).toEqual([
      'first',
      'second',
      'user',
      'stale',
    ]);
    // Planner off: the marks are ignored and the user's order counts alone.
    expect(dayPlan(tasks, TODAY, 5, false).planned.map((x: { id: string }) => x.id)).toEqual([
      'user',
      'stale',
      'second',
      'first',
    ]);
  });
});

describe('what never carries a mark', () => {
  it('an import that carries a mark stores the task without it', async () => {
    const runtime = createJsonRuntime(manifest);
    const parsed = await runtime.parse(
      'json',
      {
        kind: 'json',
        text: JSON.stringify([
          { collection: 'task', title: 'Von draußen', list: 'Eingang', plannedFor: '2026-11-12', planMark: { date: '2026-11-12', order: 0 } },
        ]),
      },
      { today: TODAY, options: {}, batchId: 'b' },
    );
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]!.errors ?? []).toEqual([]);
    expect(parsed.candidates[0]!.data).toMatchObject({ title: 'Von draußen', plannedFor: '2026-11-12' });
    expect(parsed.candidates[0]!.data).not.toHaveProperty('planMark');
  });

  it('a write-back that touches only plannedFor/planMark is no automation event; completed still is', () => {
    const watched = (m: string, c: string) =>
      m === 'todos' ? automation.watch?.[c as 'task'] : undefined;
    const silent = eventsOf(
      {
        table: 'todos_task',
        kind: 'updated',
        id: 't',
        data: { title: 'T', done: false },
        before: { plannedFor: '2026-11-10', planMark: undefined },
      },
      1,
      automation.derive,
      watched,
    );
    expect(silent).toEqual([]);
    const done = eventsOf(
      {
        table: 'todos_task',
        kind: 'updated',
        id: 't',
        data: { title: 'T', done: true },
        before: { done: false, plannedFor: '2026-11-10' },
      },
      1,
      automation.derive,
      watched,
    );
    expect(done.map((e) => e.type)).toEqual(['todos.task.updated', 'todos.task.completed']);
  });
});

describe('clean-up while the planner is off', () => {
  const stored = (enabled: boolean) =>
    db.table('_modules').put({
      id: 'planner',
      enabled,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });

  it('restorePatch hands a planner-own date back to `prior`, drops a stale mark, leaves the rest alone', () => {
    expect(restorePatch(own('2026-11-14', 0, '2026-11-12'))).toEqual({ plannedFor: '2026-11-12', planMark: undefined });
    expect(restorePatch(own('2026-11-14'))).toEqual({ plannedFor: undefined, planMark: undefined });
    expect(restorePatch({ plannedFor: '2026-11-10', planMark: { date: '2026-11-14', order: 0 } })).toEqual({ planMark: undefined });
    expect(restorePatch({ plannedFor: '2026-11-10' })).toEqual({});
  });

  it('runs only on a stored "off" (never by default, never while the planner is on) and is idempotent', async () => {
    const a = await taskRepo.create({ ...base, title: 'Später Do', ...own('2026-11-14', 0, '2026-11-12') });
    const b = await taskRepo.create({ ...base, title: 'eigenes Datum', plannedFor: '2026-11-10' });
    expect(await cleanupPlanMarks()).toBe(0); // no stored choice: the manifest default applies
    await stored(true);
    expect(await cleanupPlanMarks()).toBe(0);
    await stored(false);
    expect(await cleanupPlanMarks()).toBe(1);
    expect(await taskRepo.get(a.id)).toMatchObject({ plannedFor: '2026-11-12' });
    expect((await taskRepo.get(a.id))!.planMark).toBeUndefined();
    expect(await taskRepo.get(b.id)).toMatchObject({ plannedFor: '2026-11-10' });
    expect(await cleanupPlanMarks()).toBe(0);
  });
});
