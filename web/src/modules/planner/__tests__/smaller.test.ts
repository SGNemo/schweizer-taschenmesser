/**
 * „Kleiner machen …“ (docs/design/usecases/tag-kippt/PACKAGES.md P1): the thing becomes its first step – same id, same
 * day and lock – and the rest a new thing of the old title, without a day or for later. One undo; nothing else moves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable, type PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { makeSmaller, sourceAbilities } from '../actions';
import manifest from '../manifest';
import { assignmentRepo } from '../repo';
import { runsSettled, setManifestsForTests } from '../services';

const SA = '2026-11-28';
const SO = '2026-11-29';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

const place = async () => {
  const rows = await assignmentRepo.active().toArray();
  const tasks = (await taskRepo.active().toArray()) as unknown as {
    id: string;
    title: string;
    someday?: boolean;
  }[];
  return Object.fromEntries(
    tasks.map((x) => [
      x.title,
      x.someday ? 'later' : (rows.find((r) => r.itemKey === `todos:${x.id}`)?.date ?? 'none'),
    ]),
  );
};
const entries = async (ids: string[]): Promise<PlannableEntry[]> =>
  (await collectPlannable({ today: SA, until: '2026-12-31' }, [todos])).filter((e) =>
    ids.includes(e.id),
  );

beforeEach(async () => {
  setNow(() => new Date(`${SA}T16:00:00`).getTime());
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'todos_list',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  setManifestsForTests(async () => [todos]);
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await db.table('_modules').put({
    id: 'todos',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
  await enableModule(manifest);
  for (const [id, title, date, locked] of [
    ['a', 'Wäsche', SA, false],
    ['b', 'Küche', SA, false],
    ['c', 'Pfand', SA, false],
    ['d', 'Zahnarzt', SA, true],
    ['e', 'Bad', SO, false],
  ] as const) {
    await taskRepo.create(
      { listId: 'inbox', done: false, priority: 0, order: 0, title, estimateMin: 30 },
      { id },
    );
    await assignmentRepo.create(
      {
        itemKey: `todos:${id}`,
        k: 0,
        of: 1,
        date,
        minutes: 30,
        order: 0,
        reason: 'new',
        ...(locked ? { locked: true } : {}),
      },
      { id: `todos:${id}#0` },
    );
  }
  resetUndoJournal();
  useUiStore.setState({ toasts: [] });
});
afterEach(async () => {
  await runsSettled();
  setNow();
  setManifestsForTests(undefined);
  resetUndoJournal();
});

describe('makeSmaller', () => {
  const tasks = async () =>
    (await taskRepo.active().toArray()) as unknown as {
      id: string;
      title: string;
      estimateMin?: number;
      someday?: boolean;
    }[];

  it('the step keeps the id, day and lock; the rest is a new thing without a day – one undo brings back both', async () => {
    const before = await place();
    const [pfand] = await entries(['c']);
    expect(await makeSmaller(pfand!, 'Pfand sammeln', 'week', {})).toBe(true);
    await runsSettled();
    expect(undoDepth()).toBe(1);
    expect(await place()).toEqual({ ...before, 'Pfand sammeln': SA, Pfand: 'none' });
    const rest = (await tasks()).find((x) => x.title === 'Pfand')!;
    expect(rest.id).not.toBe('c');
    expect(rest.estimateMin).toBe(30);
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Heute nur: Pfand sammeln · Rest: diese Woche',
    );
    await undoLast();
    await runsSettled();
    expect(await place()).toEqual(before);
  });

  it('„fest“ stays with the step; the rest can go to the next weeks', async () => {
    const [zahnarzt] = await entries(['d']);
    await makeSmaller(zahnarzt!, 'Zahnarzt anrufen', 'later', {});
    await runsSettled();
    const row = (await assignmentRepo.active().toArray()).find((r) => r.itemKey === 'todos:d')!;
    expect(row).toMatchObject({ date: SA, locked: true });
    expect(await place()).toMatchObject({ 'Zahnarzt anrufen': SA, Zahnarzt: 'later' });
  });

  it('a series goes with the rest: the step is a one-off, so a tick never makes the next turn the step', async () => {
    await taskRepo.update('b', {
      recurrence: { freq: 'weekly', interval: 1 },
      dueDate: SA,
      dueTime: '18:00',
      dueRemind: true,
    });
    const [küche] = await entries(['b']);
    await makeSmaller(küche!, 'Spüle leeren', 'week', {});
    await runsSettled();
    const all = (await taskRepo.active().toArray()) as unknown as {
      id: string;
      title: string;
      recurrence?: unknown;
      dueRemind?: boolean;
    }[];
    expect(all.find((x) => x.id === 'b')).toMatchObject({ title: 'Spüle leeren' });
    expect(all.find((x) => x.id === 'b')?.recurrence).toBeUndefined();
    expect(all.find((x) => x.id === 'b')?.dueRemind).toBeUndefined();
    expect(all.find((x) => x.title === 'Küche')).toMatchObject({
      recurrence: { freq: 'weekly', interval: 1 },
      dueRemind: true,
    });
  });

  it('an empty or unchanged step does nothing (no undo entry); ToDos offer the step', async () => {
    const [wäsche] = await entries(['a']);
    expect(await makeSmaller(wäsche!, '  ', 'week', {})).toBe(false);
    expect(await makeSmaller(wäsche!, 'Wäsche', 'week', {})).toBe(false);
    expect(undoDepth()).toBe(0);
    expect((await sourceAbilities()).todos?.split).toBe(true);
  });
});
