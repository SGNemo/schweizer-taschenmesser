/**
 * `plan.requested` with `ref` (planner hub S3, docs/design/planner-hub/CONCEPT-SOURCES.md §3.3): the planner places
 * the thing itself – its own item row, no ToDo – and that row is what a source reads as `ctx.requested`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { plannedDay } from '@/core/entitylinks';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { addRequested, exclude, unrequest } from '../actions';
import { buildBoard } from '../board';
import { assignmentRepo, itemRepo, plannerRepos } from '../repo';
import {
  buildInputs,
  LAST_RUN_KEY,
  requestedIds,
  runPlanner,
  type LastRun,
  type RunDeps,
} from '../run';
import start, { runsSettled, setManifestsForTests } from '../services';
import { DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from '../settings';

const TODAY = '2026-11-16'; // Monday
const NOW = new Date(2026, 10, 16, 10, 0).getTime();
const SHOP = 'shopping-default';
const KEY = `lists:${SHOP}`;
const todos = getManifest('todos')!;
const lists = getManifest('lists')!;
const listRepo = createCollectionRepo(lists, 'list');
const entryRepo = createCollectionRepo(lists, 'item');
const taskRepo = createCollectionRepo(todos, 'task');
const moduleRow = (id: string, enabled: boolean) =>
  db.table('_modules').put({
    id,
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
const messages = () => useUiStore.getState().toasts.map((t) => t.message);
const request = () => addRequested({ title: 'Einkauf', ref: { module: 'lists', id: SHOP } });
const deps = (): RunDeps => ({
  today: TODAY,
  manifests: [todos, lists],
  settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' },
  planLimit: 3,
  settled: true,
});
const planned = async () =>
  (await assignmentRepo.active().toArray()).filter((a) => a.itemKey === KEY);

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'todos_list',
    'lists_list',
    'lists_item',
    '_settings',
    '_meta',
    '_modules',
    '_outbox',
  ])
    await db.table(t).clear();
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await listRepo.create({ name: 'Einkauf', kind: 'shopping', order: 0 }, { id: SHOP });
  for (const name of ['Milch', 'Brot', 'Eier'])
    await entryRepo.create({ listId: SHOP, name, done: false, order: 0 });
  await moduleRow('todos', true);
  await moduleRow('lists', true);
  await moduleRow('planner', true);
  await setSettings(PLANNER_SCOPE, { horizonDays: '7' });
  bus.clear();
  useUiStore.setState({ toasts: [] });
  setManifestsForTests(async () => [todos, lists]);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
  bus.clear();
});

describe('requestedIds', () => {
  it('collects the live, not excluded item rows per module, sorted', () => {
    expect(
      requestedIds([
        { source: { module: 'lists', id: 'b' } },
        { source: { module: 'lists', id: 'a' } },
        { source: { module: 'lists', id: 'c' }, excluded: true },
        { source: { module: 'todos', id: 't1' } },
      ]),
    ).toEqual({ lists: ['a', 'b'], todos: ['t1'] });
    expect(requestedIds([])).toEqual({});
  });

  it('`collectPlannable` hands every source its own ids only', async () => {
    const seen: Record<string, unknown> = {};
    const fake = (id: string) =>
      ({
        id,
        contributions: {
          plannable: async () => ({
            default: {
              list: async (ctx: unknown) => {
                seen[id] = ctx;
                return [];
              },
            },
          }),
        },
      }) as never;
    const ctx = { today: TODAY, until: TODAY };
    await collectPlannable(ctx, [fake('a'), fake('b')], { a: ['x'], c: ['y'] });
    expect(seen).toEqual({ a: { ...ctx, requested: ['x'] }, b: ctx });
  });
});

describe('plan.requested with ref', () => {
  it('an undated list is no plan thing before the request', async () => {
    await runPlanner(deps(), { force: true });
    expect(await planned()).toEqual([]);
    expect(await itemRepo.get(KEY)).toBeUndefined();
  });

  it('writes the planner’s item row, creates no ToDo, places ONE row and says the day', async () => {
    expect(await request()).toBe(true);
    expect(await taskRepo.active().toArray()).toEqual([]);
    expect(await itemRepo.get(KEY)).toMatchObject({ source: { module: 'lists', id: SHOP } });
    expect((await itemRepo.get(KEY))?.excluded).toBeUndefined();
    const rows = await planned();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: TODAY, minutes: 45 });
    expect(messages()).toEqual(['Im Plan: Einkaufen · 3 Dinge · Mo']);
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Rückgängig');
    expect(await plannedDay({ module: 'lists', id: SHOP })).toBe(TODAY);
  });

  it('the run passes the id through `ctx.requested`; the request is part of the input hash', async () => {
    const before = await buildInputs(deps(), plannerRepos());
    expect(before.entries).toEqual([]);
    await request();
    const after = await buildInputs(deps(), plannerRepos());
    expect(after.entries.map((e) => [e.moduleId, e.id, e.title])).toEqual([
      ['lists', SHOP, 'Einkaufen · 3 Dinge'],
    ]);
    expect(after.hash).not.toBe(before.hash);
    // deterministic: the same rows give the same hash, and a rerun writes nothing
    expect((await buildInputs(deps(), plannerRepos())).hash).toBe(after.hash);
    const again = await runPlanner(deps(), { force: true });
    expect(again.rowWrites).toBe(0);
  });

  it('the undo takes the list out again', async () => {
    await request();
    expect(await undoLast()).toBeTruthy();
    await runsSettled();
    expect(await itemRepo.get(KEY)).toBeUndefined();
    await runPlanner(deps(), { force: true });
    expect(await planned()).toEqual([]);
  });

  // This and the three marked tests below fail on feat/plan-stays-put (reported): a run takes the rows of an
  // excluded thing away only while its source still lists it (`run.ts buildInputs` fills `removeKeys` from the
  // entries) – a list asked in by ref is no longer listed once it is excluded, so its row stays stored.
  it('„Nicht planen“ takes the list out; asking again brings it back', async () => {
    await request();
    const [entry] = (await buildInputs(deps(), plannerRepos())).entries;
    await exclude(entry!, {});
    expect((await itemRepo.get(KEY))?.excluded).toBe(true);
    expect(await planned()).toEqual([]);
    expect((await buildInputs(deps(), plannerRepos())).entries).toEqual([]);
    await request();
    expect((await itemRepo.get(KEY))?.excluded).toBeUndefined();
    expect(await planned()).toHaveLength(1);
  });

  it('the last entry ticked: the board hides the list, the row stays stored; with a new entry it is back on its day', async () => {
    await request();
    // Laid on Wednesday, so „its day“ is not just today.
    await assignmentRepo.update(`${KEY}#0`, { date: '2026-11-18' });
    for (const i of await entryRepo.active().toArray())
      await entryRepo.update(i.id, { done: true });
    const pass = await runPlanner(deps());
    expect(pass.ran).toBe(true);
    // A background run tidies nothing: the row is stored as it was.
    expect(pass.rowWrites).toBe(0);
    expect((await planned()).map((a) => a.date)).toEqual(['2026-11-18']);
    const shown = async () => {
      const inputs = await buildInputs(deps(), plannerRepos());
      const last = await getMeta<LastRun>(LAST_RUN_KEY);
      const board = buildBoard({
        today: TODAY,
        span: 7,
        settings: deps().settings,
        dayRows: [],
        itemRows: await itemRepo.active().toArray(),
        assignments: await assignmentRepo.active().toArray(),
        entries: inputs.entries,
        calendar: [],
        unplaced: last?.unplaced ?? [],
        titles: { ...last?.titles },
      });
      return [
        ...board.days.flatMap((d) => d.rows.map((r) => [d.date, r.itemKey])),
        ...board.waiting.map((r) => ['waiting', r.itemKey]),
        ...board.open.map((r) => ['open', r.itemKey]),
      ];
    };
    expect(await shown()).toEqual([]);
    await entryRepo.create({ listId: SHOP, name: 'Salz', done: false, order: 0 });
    expect((await runPlanner(deps())).rowWrites).toBe(0);
    expect((await planned()).map((a) => a.date)).toEqual(['2026-11-18']);
    expect(await shown()).toEqual([['2026-11-18', KEY]]);
  });

  it('a hard due of the request is kept on the item row', async () => {
    await addRequested({
      title: 'Einkauf',
      ref: { module: 'lists', id: SHOP },
      due: { date: '2026-11-18', hard: true },
    });
    expect((await itemRepo.get(KEY))?.due).toEqual({ date: '2026-11-18', hard: true });
  });

  it('a thing its source does not list leaves no row and no toast', async () => {
    expect(await addRequested({ title: 'x', ref: { module: 'lists', id: 'nope' } })).toBe(false);
    expect(await itemRepo.get('lists:nope')).toBeUndefined();
    expect(messages()).toEqual([]);
  });

  it('never the vault, never a module that is no plan source', async () => {
    expect(await addRequested({ title: 'x', ref: { module: 'accounts', id: 'a1' } })).toBe(false);
    expect(await addRequested({ title: 'x', ref: { module: 'notes', id: 'n1' } })).toBe(false);
    expect(await itemRepo.active().toArray()).toEqual([]);
    expect(await taskRepo.active().toArray()).toEqual([]);
  });

  it('with the planner off nothing is written', async () => {
    await moduleRow('planner', false);
    expect(await request()).toBe(false);
    expect(await itemRepo.get(KEY)).toBeUndefined();
    expect(messages()).toEqual(['Der Planer ist aus.']);
  });

  it('over the bus: the service places the list', async () => {
    const stop = start();
    try {
      await bus.emit('plan.requested', { title: 'Einkauf', ref: { module: 'lists', id: SHOP } });
      await runsSettled();
      expect(await planned()).toHaveLength(1);
      expect(await taskRepo.active().toArray()).toEqual([]);
    } finally {
      stop();
    }
  }, 20_000);
});

describe('plan.unrequested („Nicht mehr planen“)', () => {
  const unplan = () => unrequest({ title: 'Einkauf', ref: { module: 'lists', id: SHOP } });

  // (fails, see „Nicht planen“ above)
  it('ends the request: the item row is excluded, the list leaves the plan; one undo brings it back', async () => {
    await request();
    useUiStore.setState({ toasts: [] });
    expect(await unplan()).toBe(true);
    expect((await itemRepo.get(KEY))?.excluded).toBe(true);
    expect(await planned()).toEqual([]);
    expect((await buildInputs(deps(), plannerRepos())).entries).toEqual([]);
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Rückgängig');
    expect(await undoLast()).toBeTruthy();
    await runsSettled();
    expect((await itemRepo.get(KEY))?.excluded).toBeUndefined();
    await runPlanner(deps(), { force: true });
    expect(await planned()).toHaveLength(1);
  });

  // (fails, see „Nicht planen“ above)
  it('an emptied list no longer returns with its next entry once the request ended', async () => {
    await request();
    for (const i of await entryRepo.active().toArray())
      await entryRepo.update(i.id, { done: true });
    await runPlanner(deps());
    await unplan();
    await entryRepo.create({ listId: SHOP, name: 'Salz', done: false, order: 0 });
    await runPlanner(deps(), { force: true });
    expect(await planned()).toEqual([]);
  });

  it('never the vault, never a module that is no plan source', async () => {
    expect(await unrequest({ title: 'x', ref: { module: 'accounts', id: 'a1' } })).toBe(false);
    expect(await unrequest({ title: 'x', ref: { module: 'notes', id: 'n1' } })).toBe(false);
    expect(await itemRepo.active().toArray()).toEqual([]);
  });

  // (fails, see „Nicht planen“ above)
  it('over the bus: the service ends the request', async () => {
    await request();
    const stop = start();
    try {
      await bus.emit('plan.unrequested', { title: 'Einkauf', ref: { module: 'lists', id: SHOP } });
      await runsSettled();
      expect((await itemRepo.get(KEY))?.excluded).toBe(true);
      expect(await planned()).toEqual([]);
    } finally {
      stop();
    }
  }, 20_000);
});
