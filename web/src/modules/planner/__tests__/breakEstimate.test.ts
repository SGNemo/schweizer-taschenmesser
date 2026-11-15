// @vitest-environment jsdom
/**
 * Use case „Wochenende retten“, package 4a: „Als Pause …“ turns a thing into a blocker of its day and the source
 * removes it (no open ToDo stays); one undo brings back the ToDo, its plan and takes the blocker out. „Dauer …“
 * and the field („Duschen 15 Min“) set the estimate; a „Pause …“ line in the field or the day sheet is a blocker.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { addFromField, applyDaySetup, asBreak, setEstimate } from '../actions';
import { breakOps, setupThings } from '../daySetup';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { runsSettled, runUser, setManifestsForTests } from '../services';

const SAT = '2026-11-14';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 10, 0).getTime());
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

async function snapshot() {
  const tasks = (await taskRepo.active().toArray()) as unknown as {
    id: string;
    title: string;
    plannedFor?: string;
    planMark?: unknown;
  }[];
  return {
    tasks: tasks
      .map((x) => ({ id: x.id, title: x.title, plannedFor: x.plannedFor, planMark: x.planMark }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    blockers: (await dayRepo.active().toArray()).flatMap((d) =>
      d.blockers.map((b) => [d.date, b.label, b.min]),
    ),
    items: (await itemRepo.active().toArray()).map((r) => r.id).sort(),
    rows: (await assignmentRepo.active().toArray())
      .map((r) => [r.id, r.date] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  };
}

const entries = () => collectPlannable({ today: SAT, until: '2026-11-20' }, [todos]);
const lastToast = () => useUiStore.getState().toasts.at(-1)!;

it('„Als Pause …“: a 2-h blocker on the row’s day, no open ToDo; one undo restores ToDo, plan and day', async () => {
  for (const title of ['Duschen', 'Zocken', 'Bude'])
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
  const zocken = (await entries()).find((e) => e.title === 'Zocken')!;
  expect(before.rows.some(([id]) => id.startsWith(`todos:${zocken.id}#`))).toBe(true);

  expect(await asBreak(zocken, SAT, 120, {})).toBe(true);
  await runsSettled();
  const after = await snapshot();
  expect(after.tasks.map((x) => x.title).sort()).toEqual(['Bude', 'Duschen']);
  expect(after.blockers).toEqual([[SAT, 'Zocken', 120]]);
  expect(after.rows.some(([id]) => id.startsWith(`todos:${zocken.id}#`))).toBe(false);
  // Not a tick: the ToDo is gone, never done.
  expect((await taskRepo.table.get(zocken.id))!.done).toBe(false);
  expect(lastToast().message).toBe('Pause Sa: Zocken · 2 h');

  lastToast().action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('„Dauer …“ writes the estimate through the source', async () => {
  await taskRepo.create({
    listId: 'inbox',
    done: false,
    priority: 0,
    order: 0,
    title: 'Duschen',
  });
  const e = (await entries())[0]!;
  expect(await setEstimate(e, 15, {})).toBe(true);
  expect((await taskRepo.get(e.id))!.estimateMin).toBe(15);
  expect((await entries())[0]!.durationMin).toBe(15);
});

it('the field: „Duschen 15 Min“ is a ToDo of 15 min, „Pause 2 Std Zocken“ a blocker of today and no ToDo', async () => {
  expect(await addFromField('Duschen 15 Min', {})).toBe(true);
  expect(await addFromField('Pause 2 Std Zocken', {})).toBe(true);
  const tasks = await taskRepo.active().toArray();
  expect(tasks.map((x) => [x.title, x.estimateMin])).toEqual([['Duschen', 15]]);
  expect((await snapshot()).blockers).toEqual([[SAT, 'Zocken', 120]]);
});

it('„Tage einteilen“: a „Pause …“ line is a blocker of its day, the other lines stay ToDos in typed order', async () => {
  const things = setupThings('Steuer 2 Std\nPause So 2 Std Zocken\nBude 1 Std', SAT, true);
  expect(things.map((th) => [th.fields.title, th.isBreak ?? false])).toEqual([
    ['Steuer', false],
    ['Zocken', true],
    ['Bude', false],
  ]);
  expect(breakOps(things, SAT)).toEqual([
    { op: 'block', date: '2026-11-15', label: 'Zocken', min: 120, from: '', to: '' },
  ]);
  expect(await applyDaySetup([], things, [SAT], {})).toBe(true);
  await runsSettled();
  const snap = await snapshot();
  expect(snap.tasks.map((x) => x.title).sort()).toEqual(['Bude', 'Steuer']);
  expect(snap.blockers).toEqual([['2026-11-15', 'Zocken', 120]]);
  lastToast().action!.run();
  await expect
    .poll(async () => (await snapshot()).blockers.length + (await snapshot()).tasks.length, {
      timeout: 3000,
    })
    .toBe(0);
});
