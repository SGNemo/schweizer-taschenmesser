// @vitest-environment jsdom
/**
 * Use case „Wochenende retten“, package 4a: „Als Pause …“ turns a thing into a blocker of its day and the source
 * removes it (no open ToDo stays); one undo brings back the ToDo, its plan and takes the blocker out. „Dauer …“
 * and the field („Duschen 15 Min“) set the estimate; a „Pause …“ line in the field or the day sheet is a blocker.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { getMeta } from '@/core/db/metaKv';
import { addFromField, applyDaySetup, asBreak, setEstimate } from '../actions';
import { buildBoard } from '../board';
import { LAST_RUN_KEY, type LastRun } from '../run';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';
import { breakOps, setupThings, type SetupRead } from '../daySetup';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { runsSettled, runUser, setManifestsForTests } from '../services';

const SAT = '2026-11-14';
/** The sheet reads lines with the capture's targets of this device (planner, ToDos and Kalender on, German). */
const READ: SetupRead = { available: ['todo', 'event', 'reminder', 'break', 'note'], breaks: true };
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
/** The item keys the board shows on its days (stored rows, the live ToDos, the last run's titles – as the page). */
const shownKeys = async () => {
  const last = await getMeta<LastRun>(LAST_RUN_KEY);
  const board = buildBoard({
    today: SAT,
    span: 7,
    settings: DEFAULT_PLANNER_SETTINGS,
    dayRows: await dayRepo.active().toArray(),
    itemRows: await itemRepo.active().toArray(),
    assignments: await assignmentRepo.active().toArray(),
    entries: await entries(),
    calendar: [],
    unplaced: last?.unplaced ?? [],
    titles: { ...last?.titles },
  });
  return [...board.days.flatMap((d) => d.rows), ...board.open, ...board.waiting].map(
    (r) => r.itemKey,
  );
};

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
  await runUser('plan', async () => undefined, { reshuffle: true });
  await runsSettled();
  const before = await snapshot();
  const zocken = (await entries()).find((e) => e.title === 'Zocken')!;
  expect(before.rows.some(([id]) => id.startsWith(`todos:${zocken.id}#`))).toBe(true);

  expect(await asBreak(zocken, SAT, 120, {})).toBe(true);
  await runsSettled();
  const after = await snapshot();
  expect(after.tasks.map((x) => x.title).sort()).toEqual(['Bude', 'Duschen']);
  expect(after.blockers).toEqual([[SAT, 'Zocken', 120]]);
  // Nothing is tidied and nothing else moves: every row is stored on its day as before – the board just no
  // longer shows the thing that is gone.
  expect(after.rows).toEqual(before.rows);
  expect(await shownKeys()).not.toContain(`todos:${zocken.id}`);
  expect(await shownKeys()).toHaveLength(2);
  // Not a tick: the ToDo is gone, never done.
  expect((await taskRepo.table.get(zocken.id))!.done).toBe(false);
  expect(lastToast().message).toBe('Pause Sa: Zocken · 2 h');

  lastToast().action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('a recurring ToDo: the series goes on, nothing is ticked, one undo (journal) restores exactly the start', async () => {
  const task = await taskRepo.create({
    listId: 'inbox',
    done: false,
    priority: 3,
    order: 0,
    title: 'Zocken',
    dueDate: SAT,
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [6] },
  });
  // Ticked and reopened once before: the next instance already exists as a tombstone.
  await taskRepo.create(
    {
      listId: 'inbox',
      done: false,
      priority: 3,
      order: 0,
      title: 'Zocken',
      dueDate: '2026-11-21',
    },
    { id: `${task.id}:2026-11-21` },
  );
  await taskRepo.remove(`${task.id}:2026-11-21`);
  await runUser('plan', async () => undefined, { reshuffle: true });
  await runsSettled();
  const before = await snapshot();
  const e = (await entries()).find((x) => x.id === task.id)!;
  expect(await asBreak(e, SAT, 60, {})).toBe(true);
  await runsSettled();
  const live = await taskRepo.active().toArray();
  expect(live.map((t) => [t.dueDate, t.done])).toEqual([['2026-11-21', false]]);
  expect((await taskRepo.table.get(task.id))!.done).toBe(false);
  const toast = lastToast();
  toast.action!.run();
  await expect.poll(() => lastToast().message, { timeout: 3000 }).toBe('Rückgängig gemacht.');
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('a failed blocker write brings the thing back as it was (no second open instance of a series)', async () => {
  const task = await taskRepo.create({
    listId: 'inbox',
    done: false,
    priority: 0,
    order: 0,
    title: 'Zocken',
    dueDate: SAT,
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [6] },
  });
  const e = (await entries()).find((x) => x.id === task.id)!;
  const spy = vi.spyOn(dayRepo, 'upsert').mockRejectedValueOnce(new Error('disk full'));
  await expect(asBreak(e, SAT, 60, {})).rejects.toThrow('disk full');
  spy.mockRestore();
  const live = await taskRepo.active().toArray();
  expect(live.map((t) => [t.id, t.done])).toEqual([[task.id, false]]);
  expect(await dayRepo.active().toArray()).toEqual([]);
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
  const things = setupThings('Steuer 2 Std\nPause So 2 Std Zocken\nBude 1 Std', READ);
  expect(things.map((th) => [th.fields.title, th.type === 'break'])).toEqual([
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
