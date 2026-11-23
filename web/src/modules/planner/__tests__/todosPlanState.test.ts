/**
 * ToDos show where a task stands in the plan from their own fields (todos-plan-state): `plannedFor` + `planMark` agree
 * = „im Plan: <Tag>“, else „noch nicht im Plan“; „fest“ and „Nicht planen“ come from `planFacts`. Every path that
 * lays, moves or takes a thing off must leave the ToDo's fields saying the same as the planner's row – and „In den
 * Plan …“ from ToDos (`plan.requested` with `refs` and `day`) moves exactly the named things, as one undo with one
 * toast (CONCEPT-MIGRATION §7, the four rules).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { planFacts } from '@/core/entitylinks/planRow';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable, type PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { isPlannerOwned } from '@/core/modules/types';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { addRequested, exclude, layHere, moveTo, setLocked, takeOff } from '../actions';
import manifest from '../manifest';
import { assignmentRepo, itemRepo } from '../repo';
import { runsSettled, setManifestsForTests } from '../services';

const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
const THU = '2026-11-19';
const at = (date: string, hour = 10) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');
const key = (id: string) => `todos:${id}`;
const ref = (id: string) => ({ module: 'todos', id });

const addTask = (id: string, extra: Record<string, unknown> = {}) =>
  taskRepo.create(
    {
      listId: 'inbox',
      done: false,
      priority: 0,
      order: 0,
      title: `Ding ${id}`,
      estimateMin: 30,
      ...extra,
    },
    { id },
  );
const entryOf = async (id: string): Promise<PlannableEntry> => {
  const all = await collectPlannable({ today: MON, until: '2026-11-29' }, [todos]);
  const e = all.find((x) => x.id === id);
  if (!e) throw new Error(`not listed: ${id}`);
  return e;
};

/** What the ToDo row shows, from the ToDo's own fields: the day it is in the plan, or `null` = „noch nicht im Plan“. */
async function mark(id: string): Promise<string | null> {
  const task = (await taskRepo.get(id)) as unknown as {
    plannedFor?: string;
    planMark?: { date: string; order: number };
  };
  return isPlannerOwned(task) ? task.plannedFor! : null;
}
/** The planner's own truth: the day of the thing's live row, or `null`. */
async function row(id: string): Promise<string | null> {
  const rows = (await assignmentRepo.active().toArray()).filter((r) => r.itemKey === key(id));
  return rows[0]?.date ?? null;
}
const rows = async () =>
  Object.fromEntries((await assignmentRepo.active().toArray()).map((r) => [r.id, r.date]));
const tasks = async () =>
  Object.fromEntries(
    ((await taskRepo.active().toArray()) as unknown as Record<string, unknown>[]).map((x) => [
      x.id,
      [x.plannedFor, x.planMark],
    ]),
  );
const toasts = () => useUiStore.getState().toasts.map((x) => x.message);

beforeEach(async () => {
  setNow(() => at(MON).getTime());
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
  resetUndoJournal();
  useUiStore.setState({ toasts: [] });
});
afterEach(async () => {
  await runsSettled();
  setNow();
  setManifestsForTests(undefined);
  resetUndoJournal();
});

describe('the mark follows every path', () => {
  it('lay, move, take off, „Hierher legen“ and undo: the ToDo says what the row says', async () => {
    await addTask('a');
    expect(await mark('a')).toBeNull();

    await moveTo(await entryOf('a'), TUE, {});
    expect([await row('a'), await mark('a')]).toEqual([TUE, TUE]);

    await moveTo(await entryOf('a'), THU, {});
    expect([await row('a'), await mark('a')]).toEqual([THU, THU]);

    await undoLast();
    expect([await row('a'), await mark('a')]).toEqual([TUE, TUE]);

    await takeOff(await entryOf('a'), {});
    expect([await row('a'), await mark('a')]).toEqual([null, null]);

    // A date set in ToDos is no day in the plan (the planner's muted row „In ToDos: Mi“) …
    await taskRepo.update('a', { plannedFor: WED });
    expect(await mark('a')).toBeNull();
    // … until „Hierher legen“ lays it.
    await layHere(await entryOf('a'), WED, {});
    expect([await row('a'), await mark('a')]).toEqual([WED, WED]);
  });

  it('an import brings no mark: a date from outside reads as „noch nicht im Plan“', async () => {
    // The import strips `planMark` (internal); a planned date alone is the person's own.
    await addTask('imp', { plannedFor: TUE });
    expect(await mark('imp')).toBeNull();
    expect(await row('imp')).toBeNull();
  });

  it('two devices: mark and date mixed by field LWW read as „noch nicht im Plan“', async () => {
    await addTask('b');
    await moveTo(await entryOf('b'), TUE, {});
    // Device B moved it to Thursday (mark), device A's older date won the other field.
    await taskRepo.update('b', { planMark: { date: THU, order: 0 } } as never);
    expect(await mark('b')).toBeNull();
  });

  it('„fest“ and „Nicht planen“ are read from the planner without a new contract', async () => {
    await addTask('c');
    await addTask('d');
    await addTask('e');
    await moveTo(await entryOf('c'), TUE, {});
    await setLocked(await entryOf('c'), true, {});
    await exclude(await entryOf('d'), {});
    const facts = await planFacts('todos', ['c', 'd', 'e']);
    expect(facts.get('c')).toEqual({ locked: true });
    expect(facts.get('d')).toEqual({ excluded: true });
    expect(facts.has('e')).toBe(false);
  });

  it('planner off: `planFacts` knows nothing', async () => {
    await addTask('c');
    await moveTo(await entryOf('c'), TUE, {});
    await setLocked(await entryOf('c'), true, {});
    await db.table('_modules').update('planner', { enabled: false });
    expect((await planFacts('todos', ['c'])).size).toBe(0);
  });
});

describe('„In den Plan …“ from ToDos (`plan.requested` with refs and day)', () => {
  async function setup() {
    for (const id of ['n1', 'n2', 'n3', 'n4', 'p1', 'p2']) await addTask(id);
    await moveTo(await entryOf('p1'), MON, {});
    await moveTo(await entryOf('p2'), WED, {});
    await setLocked(await entryOf('p2'), true, {});
    await exclude(await entryOf('n4'), {});
    await runsSettled();
    resetUndoJournal();
    useUiStore.setState({ toasts: [] });
  }

  it('lays exactly the chosen things on the day, moves nothing else: one undo, one toast', async () => {
    await setup();
    const rowsBefore = await rows();
    const tasksBefore = await tasks();
    expect(
      await addRequested({ title: '', refs: [ref('n1'), ref('n2'), ref('p2')], day: TUE }),
    ).toBe(true);
    await runsSettled();
    expect(undoDepth()).toBe(1);
    expect(toasts()).toEqual(['3 Dinge liegen auf Di']);
    for (const id of ['n1', 'n2', 'p2'])
      expect([id, await row(id), await mark(id)]).toEqual([id, TUE, TUE]);
    // The lock moved with p2 (it binds proposals, not him).
    expect((await planFacts('todos', ['p2'])).get('p2')).toEqual({ locked: true });
    // Nothing else: n3 stays without a day, p1 stays on Monday, n4 stays „Nicht planen“.
    const after = await rows();
    for (const [id, date] of Object.entries(rowsBefore))
      if (!id.startsWith(key('p2'))) expect(after[id]).toBe(date);
    expect(await row('n3')).toBeNull();
    const tasksAfter = await tasks();
    for (const id of ['n3', 'n4', 'p1']) expect(tasksAfter[id]).toEqual(tasksBefore[id]);

    // One undo takes all three back.
    await undoLast();
    expect(await rows()).toEqual(rowsBefore);
    expect(await tasks()).toEqual(tasksBefore);
  });

  it('a thing that was „Nicht planen“ is asked in again when named', async () => {
    await setup();
    await addRequested({ title: '', refs: [ref('n4')], day: THU });
    expect([await row('n4'), await mark('n4')]).toEqual([THU, THU]);
    expect((await itemRepo.get(key('n4')))?.excluded).toBeUndefined();
    expect(toasts().at(-1)).toBe('Liegt auf Do');
  });

  it('without a day: „Noch ohne Tag“ – a day it had is taken off, the ToDo mark goes', async () => {
    await setup();
    await addRequested({ title: '', refs: [ref('p1'), ref('n1')], day: null });
    await runsSettled();
    expect([await row('p1'), await mark('p1')]).toEqual([null, null]);
    expect(await row('n1')).toBeNull();
    expect(toasts().at(-1)).toBe('2 Dinge liegen unter „Noch ohne Tag“');
    expect(await row('p2')).toBe(WED);
  });

  it('ignores refs that are no plan thing (the vault, other modules, junk) and a bad day', async () => {
    await setup();
    expect(
      await addRequested({ title: '', refs: [{ module: 'accounts', id: 'x' }], day: TUE }),
    ).toBe(false);
    expect(await addRequested({ title: '', refs: [ref('n1')], day: 'morgen' })).toBe(false);
    expect(await addRequested({ title: '', refs: [ref('gone')], day: TUE })).toBe(false);
    expect(undoDepth()).toBe(0);
    expect(await row('n1')).toBeNull();
  });
});
