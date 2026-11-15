// @vitest-environment jsdom
/**
 * Planner hub P08 and P09: a thing moves to the day the user named.
 * – „schieb X auf Mi“ (a pin on a later day): the preview shows the move, „Übernehmen“ puts the thing on
 *   Wednesday, one undo restores everything.
 * – „Später“ on a thing of a day that is not today moves it off that day.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { parseInstruction } from '@/core/plan/instructions';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { applyOps, later } from '../actions';
import manifest from '../manifest';
import { assignmentRepo, itemRepo } from '../repo';
import { previewUser, runsSettled, runUser, setManifestsForTests } from '../services';

const SUN = '2026-11-15';
const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');
type Entry = Parameters<typeof later>[0];
const STEUER = { moduleId: 'todos', id: 'p2', title: 'Steuerunterlagen sortieren' } as Entry;

beforeEach(async () => {
  // A Sunday (no time by default): everything lands on Monday, as in the measured scene.
  setNow(() => new Date(2026, 10, 15, 10, 0).getTime());
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
  for (const [id, title] of [
    ['p1', 'Wohnung saugen'],
    ['p2', 'Steuerunterlagen sortieren'],
  ] as const)
    await taskRepo.create(
      { listId: 'inbox', done: false, priority: 0, order: 0, title, estimateMin: 30 },
      { id },
    );
  await runUser('plan', async () => undefined);
  await runsSettled();
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

const dayOf = async (id: string) => (await assignmentRepo.get(`todos:${id}#0`))?.date;

/** Everything the two actions may touch, without the bookkeeping fields. */
async function snapshot() {
  const tasks = (await taskRepo.active().toArray()) as unknown as {
    id: string;
    plannedFor?: string;
    planMark?: unknown;
  }[];
  return {
    tasks: tasks
      .map((x) => ({ id: x.id, plannedFor: x.plannedFor, planMark: x.planMark }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pins: (await itemRepo.active().toArray())
      .map((r) => [r.id, r.pinned] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
    rows: (await assignmentRepo.active().toArray())
      .map((r) => [r.id, r.date, r.reason] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
  };
}

it('„schieb Wohnung saugen auf Mi“: the preview shows the move, the thing is on Wednesday, one undo restores it (P09)', async () => {
  expect(await dayOf('p1')).toBe(MON);
  const before = await snapshot();
  const said = parseInstruction('schieb Wohnung saugen auf Mi', {
    today: SUN,
    items: [
      { key: 'todos:p1', title: 'Wohnung saugen', date: MON },
      { key: 'todos:p2', title: 'Steuerunterlagen sortieren', date: MON },
    ],
  });
  if (said.kind !== 'ops') throw new Error(`no ops: ${said.kind}`);
  expect(said.ops).toEqual([{ op: 'pin', key: 'todos:p1', date: WED }]);

  const preview = await previewUser(said.ops);
  expect(preview.result.diff.moved).toMatchObject([
    { id: 'todos:p1#0', from: MON, to: WED, reason: 'pinned' },
  ]);

  expect(await applyOps(said.ops, 'x', {})).toBe(true);
  await runsSettled();
  expect(await dayOf('p1')).toBe(WED);
  expect(await dayOf('p2')).toBe(MON);

  useUiStore.getState().toasts.at(-1)!.action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('„Später“ on a thing of tomorrow moves it off that day; one undo restores it (P08)', async () => {
  expect(await dayOf('p2')).toBe(MON);
  const before = await snapshot();
  expect(await later(STEUER, {})).toBe(true);
  await runsSettled();
  expect(await dayOf('p2')).toBe(TUE);
  expect(await dayOf('p1')).toBe(MON);

  useUiStore.getState().toasts.at(-1)!.action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('„Später“ on a nailed thing lifts the pin and moves it; one undo brings pin and day back', async () => {
  expect(await applyOps([{ op: 'pin', key: 'todos:p2', date: WED }], 'x', {})).toBe(true);
  await runsSettled();
  expect(await dayOf('p2')).toBe(WED);
  const before = await snapshot();
  expect(before.pins).toEqual([['todos:p2', WED]]);
  expect(await later(STEUER, {})).toBe(true);
  await runsSettled();
  expect(await dayOf('p2')).toBe('2026-11-19');
  expect((await itemRepo.get('todos:p2'))?.pinned).toBeUndefined();

  useUiStore.getState().toasts.at(-1)!.action!.run();
  await expect.poll(async () => snapshot(), { timeout: 3000 }).toEqual(before);
});

it('„Später“ on a thing of today still means tomorrow', async () => {
  // Monday morning: both things are on today.
  setNow(() => new Date(2026, 10, 16, 8, 0).getTime());
  await runUser('plan', async () => undefined);
  await runsSettled();
  expect(await dayOf('p2')).toBe(MON);
  expect(await later(STEUER, {})).toBe(true);
  await runsSettled();
  expect(await dayOf('p2')).toBe(TUE);
});
