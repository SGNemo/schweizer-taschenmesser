// @vitest-environment jsdom
/**
 * „Rest verteilen“ (package 3): one undo restores everything the evening action wrote – today's day row, the item
 * rows, the assignment rows and the ToDos' own dates the run wrote back.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { restToTomorrow } from '@/core/plan/instructions';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { applyOps } from '../actions';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { runsSettled, runUser, setManifestsForTests } from '../services';

const SAT = '2026-11-14';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 21, 0).getTime());
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
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

/** Everything the action may touch, without the bookkeeping fields. */
async function snapshot() {
  type Row = { id: string; updatedAt?: number; _f?: unknown; deviceId?: string };
  const strip = (rows: Row[]) =>
    rows
      .map(({ updatedAt: _u, _f, deviceId: _d, ...rest }) => rest)
      .sort((a, b) => a.id.localeCompare(b.id));
  const tasks = (await taskRepo.active().toArray()) as unknown as (Row & {
    plannedFor?: string;
    planMark?: unknown;
  })[];
  return {
    tasks: tasks
      .map((x) => ({ id: x.id, plannedFor: x.plannedFor, planMark: x.planMark }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    days: strip(await dayRepo.active().toArray()),
    items: strip(await itemRepo.active().toArray()),
    rows: (await assignmentRepo.active().toArray())
      .map((r) => [r.id, r.date] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  };
}

it('one undo takes back today’s day row, the item rows, the assignments and the ToDos’ dates', async () => {
  for (const title of ['Duschen', 'Pfand', 'Bude'])
    await taskRepo.create({
      listId: 'inbox',
      done: false,
      priority: 0,
      order: 0,
      title,
      estimateMin: 30,
    });
  await runUser('plan', async () => undefined);
  await runsSettled();
  const before = await snapshot();
  expect(before.rows.some(([, date]) => date === SAT)).toBe(true);

  const items = before.tasks.map((x) => {
    const date = before.rows
      .filter(([id]) => id.startsWith(`todos:${x.id}#`))
      .map(([, d]) => d)
      .sort()[0];
    return { key: `todos:${x.id}`, title: x.id, ...(date ? { date } : {}) };
  });
  const ops = restToTomorrow({ today: SAT, items });
  expect(ops.filter((o) => o.op === 'earliest').length).toBeGreaterThan(0);
  expect(await applyOps(ops, 'Auf die nächsten Tage verteilt.', {}, true)).toBe(true);
  await runsSettled();
  const after = await snapshot();
  expect(after.rows.some(([, date]) => date === SAT)).toBe(false);
  expect(after).not.toEqual(before);

  const toast = useUiStore.getState().toasts.at(-1)!;
  expect(toast.message).toBe('Auf die nächsten Tage verteilt.');
  toast.action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});
