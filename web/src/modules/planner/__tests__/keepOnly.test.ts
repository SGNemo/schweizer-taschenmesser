/**
 * „Nur das hier …“ (docs/design/usecases/tag-kippt/TARGET.md §2): what stays stays, the rest goes in one move – to
 * the next day, to „Noch ohne Tag“ or to „Nächste Wochen“ – as one undo; „fest“ stays; nothing else moves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable, type PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { bringBack, keepOnly, laterThings, START_KEY, type StartPoints } from '../actions';
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

describe('keepOnly', () => {
  it('the rest goes to the next day in one move; fest stays and is named; the first kept is the start point', async () => {
    const before = await place();
    expect(await keepOnly(SA, ['todos:a'], await entries(['b', 'c', 'd']), 'next', {})).toBe(true);
    await runsSettled();
    expect(undoDepth()).toBe(1);
    expect(await place()).toEqual({ Wäsche: SA, Küche: SO, Pfand: SO, Zahnarzt: SA, Bad: SO });
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Der Rest liegt auf So.\n1 bleibt: fest',
    );
    expect(await getMeta<StartPoints>(START_KEY)).toEqual({ [SA]: 'todos:a' });
    await undoLast();
    await runsSettled();
    expect(await place()).toEqual(before);
  });

  it('„Diese Woche, ohne Tag“ takes the rows off; „Nächste Wochen“ keeps them for later, back by one tap', async () => {
    await keepOnly(SA, ['todos:a'], await entries(['b']), 'week', {});
    await keepOnly(SA, ['todos:a'], await entries(['c']), 'later', {});
    await runsSettled();
    expect(await place()).toMatchObject({ Küche: 'none', Pfand: 'later' });
    const later = await laterThings();
    expect(later.map((e) => e.title)).toEqual(['Pfand']);
    await bringBack(later[0]!, {});
    await runsSettled();
    expect((await place()).Pfand).toBe('none');
    expect(await laterThings()).toEqual([]);
  });
});
