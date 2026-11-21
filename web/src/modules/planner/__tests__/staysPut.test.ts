/**
 * The plan stays put (docs/design/planner-rethink/CONCEPT.md): what is laid stays where it lies.
 * (a) an action moves the row of the thing it names and nothing else; no row disappears, except for „Nicht planen“;
 * (b) a week laid by hand is the same week two days later – a background run writes no row and tells no ToDo
 *     anything, the passed days are „Noch offen“;
 * (c) a background run never tidies: a source that throws, a thing no source lists any more, a done thing;
 * (d) every action is exactly one undo entry, and the undo restores the rows;
 * (e) a preview writes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable, type PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import type { PlanOp } from '@/core/plan/instructions';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import {
  addBlocker,
  addFromField,
  exclude,
  later,
  markDone,
  moveTo,
  setAvailable,
  setLocked,
} from '../actions';
import { buildBoard } from '../board';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { LAST_RUN_KEY, type LastRun } from '../run';
import { previewUser, runBackground, runsSettled, setManifestsForTests } from '../services';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
const THU = '2026-11-19';
const FRI = '2026-11-20';
const at = (date: string, hour = 10) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');
const key = (id: string) => `todos:${id}`;

const addTask = (id: string, title: string, estimateMin = 30) =>
  taskRepo.create(
    { listId: 'inbox', done: false, priority: 0, order: 0, title, estimateMin },
    { id },
  );
/** The thing as its source lists it (what the page hands to an action). */
const entryOf = async (id: string): Promise<PlannableEntry> => {
  const all = await collectPlannable({ today: MON, until: '2026-11-29' }, [todos]);
  const e = all.find((x) => x.id === id);
  if (!e) throw new Error(`not listed: ${id}`);
  return e;
};

/** `(id, date)` of every stored assignment row. */
const rowDates = async (): Promise<Record<string, string>> =>
  Object.fromEntries((await assignmentRepo.active().toArray()).map((r) => [r.id, r.date]));
const itemKeyOfRow = (id: string) => id.slice(0, id.lastIndexOf('#'));

/** Everything an action may write, without the bookkeeping fields: what an undo has to bring back. */
async function snapshot() {
  const sorted = <T extends { id: string }>(rows: T[]) =>
    rows.sort((a, b) => a.id.localeCompare(b.id));
  const tasks = (await taskRepo.active().toArray()) as unknown as {
    id: string;
    done: boolean;
    plannedFor?: string;
    planMark?: unknown;
  }[];
  return {
    rows: sorted(
      (await assignmentRepo.active().toArray()).map((r) => ({
        id: r.id,
        date: r.date,
        minutes: r.minutes,
        locked: r.locked === true,
      })),
    ),
    days: sorted(
      (await dayRepo.active().toArray()).map((d) => ({
        id: d.id,
        availableMin: d.availableMin,
        blockers: d.blockers.map((b) => [b.label, b.min]),
      })),
    ),
    items: sorted(
      (await itemRepo.active().toArray()).map((i) => ({ id: i.id, excluded: i.excluded === true })),
    ),
    tasks: sorted(
      tasks.map((x) => ({
        id: x.id,
        done: x.done,
        plannedFor: x.plannedFor,
        planMark: x.planMark,
      })),
    ),
  };
}

/** The board of `today` as the page builds it (stored rows, the live ToDos, the last run's titles). */
async function boardOn(today: string) {
  const last = await getMeta<LastRun>(LAST_RUN_KEY);
  return buildBoard({
    today,
    span: 7,
    settings: DEFAULT_PLANNER_SETTINGS,
    dayRows: await dayRepo.active().toArray(),
    itemRows: await itemRepo.active().toArray(),
    assignments: await assignmentRepo.active().toArray(),
    entries: await collectPlannable({ today, until: '2026-11-29' }, [todos]),
    calendar: [],
    unplaced: last?.unplaced ?? [],
    titles: { ...last?.titles },
  });
}

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
  vi.restoreAllMocks();
});

/** Four things laid by hand: two on Monday (today), one on Tuesday, one on Wednesday. */
const LAID: Record<string, string> = { p1: MON, p2: MON, p3: TUE, p4: WED };
async function layFour() {
  for (const [id, date] of Object.entries(LAID)) {
    await addTask(id, `Ding ${id}`);
    expect(await moveTo(await entryOf(id), date, {})).toBe(true);
  }
  await runsSettled();
  expect(await rowDates()).toEqual(
    Object.fromEntries(Object.entries(LAID).map(([id, date]) => [`${key(id)}#0`, date])),
  );
  resetUndoJournal();
  useUiStore.setState({ toasts: [] });
}

interface Case {
  name: string;
  /** Runs the action. */
  run: () => Promise<boolean>;
  /** The task ids the action names (`new` = the thing the field creates). */
  named: string[];
  /** Where the named thing's row lies afterwards (`undefined` = where it lay; `null` = the row is gone). */
  to?: string | null;
  /** What else the action must have done (so no case passes by doing nothing). */
  did: () => Promise<void>;
}

const cases: Case[] = [
  {
    name: 'addFromField on a chosen day',
    run: () => addFromField('Neu 45 Min', {}, THU),
    named: ['new'],
    to: THU,
    did: async () => {
      expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Liegt auf Do');
    },
  },
  {
    // Tuesday holds 3 h 12 of plannable time (240 min, 20 % buffer) and one thing of 30 min already.
    name: 'addFromField on a full day (more minutes than the day has)',
    run: () => addFromField('Umzug 5 Std', {}, TUE),
    named: ['new'],
    to: TUE,
    did: async () => {
      const tue = (await boardOn(MON)).days.find((d) => d.date === TUE)!;
      expect(tue.usable).toBe(192);
      expect(tue.planned).toBe(330);
      expect(tue.over).toBe(138);
    },
  },
  {
    name: 'moveTo („Verschieben …“)',
    run: async () => moveTo(await entryOf('p1'), THU, {}),
    named: ['p1'],
    to: THU,
    did: async () => {
      // A move is not a lock, and the ToDo hears its day.
      expect((await assignmentRepo.get(`${key('p1')}#0`))?.locked).toBeUndefined();
      expect(await taskRepo.get('p1')).toMatchObject({ plannedFor: THU, planMark: { date: THU } });
    },
  },
  {
    name: 'later („Später“)',
    run: async () => later(await entryOf('p2'), {}),
    named: ['p2'],
    to: TUE,
    did: async () => {
      expect(await taskRepo.get('p2')).toMatchObject({ plannedFor: TUE });
    },
  },
  {
    name: 'setLocked („Fest an diesem Tag“)',
    run: async () => setLocked(await entryOf('p3'), true, {}),
    named: ['p3'],
    did: async () => {
      expect((await assignmentRepo.get(`${key('p3')}#0`))?.locked).toBe(true);
      expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Fest an diesem Tag');
    },
  },
  {
    name: 'markDone (the tick)',
    run: async () => markDone(await entryOf('p4'), {}),
    named: ['p4'],
    did: async () => {
      expect((await taskRepo.get('p4'))!.done).toBe(true);
      // The row stays stored, the board hides it.
      const board = await boardOn(MON);
      expect(board.days.flatMap((d) => d.rows).map((r) => r.itemKey)).not.toContain(key('p4'));
    },
  },
  {
    name: 'exclude („Nicht planen“)',
    run: async () => exclude(await entryOf('p1'), {}),
    named: ['p1'],
    to: null,
    did: async () => {
      expect((await itemRepo.get(key('p1')))?.excluded).toBe(true);
    },
  },
  {
    name: 'setAvailable 0 („Tag frei“) on a day that holds things',
    run: () => setAvailable(MON, 0, {}),
    named: [],
    did: async () => {
      expect(await dayRepo.get(MON)).toMatchObject({ availableMin: 0 });
      const mon = (await boardOn(MON)).days[0]!;
      expect(mon.off).toBe(true);
      expect(mon.rows.map((r) => r.itemKey).sort()).toEqual([key('p1'), key('p2')]);
    },
  },
  {
    name: 'addBlocker that takes the whole day',
    run: () => addBlocker(MON, 'Arzt', 240, {}),
    named: [],
    did: async () => {
      expect((await dayRepo.get(MON))?.blockers).toMatchObject([{ label: 'Arzt', min: 240 }]);
      const mon = (await boardOn(MON)).days[0]!;
      expect(mon.usable).toBe(0);
      expect(mon.rows).toHaveLength(2);
    },
  },
];

describe.each(cases)('$name', ({ run, named, to, did }) => {
  beforeEach(layFour);
  /** The item keys the action named, the new thing included. */
  const namedKeys = async () => {
    const fresh = (await taskRepo.active().toArray())
      .map((x) => x.id)
      .filter((id) => !(id in LAID));
    return new Set(named.flatMap((id) => (id === 'new' ? fresh : [id])).map(key));
  };

  it('(a) only the rows of the named thing change their day; no other row disappears or appears', async () => {
    const before = await rowDates();
    expect(await run()).toBe(true);
    await runsSettled();
    const after = await rowDates();
    const keys = await namedKeys();
    expect(keys.size).toBe(named.length);
    for (const [id, date] of Object.entries(before)) {
      if (keys.has(itemKeyOfRow(id))) continue;
      expect(after[id], `${id} moved or went`).toBe(date);
    }
    for (const id of Object.keys(after))
      if (!(id in before)) expect(keys.has(itemKeyOfRow(id)), `${id} appeared`).toBe(true);
    for (const k of keys) {
      const id = `${k}#0`;
      if (to === null) expect(after[id]).toBeUndefined();
      else expect(after[id]).toBe(to ?? before[id]);
    }
    await did();
  });

  it('(d) is exactly one undo entry, and the undo restores the rows', async () => {
    const before = await snapshot();
    expect(undoDepth()).toBe(0);
    expect(await run()).toBe(true);
    await runsSettled();
    expect(await snapshot()).not.toEqual(before);
    expect(undoDepth()).toBe(1);
    // One toast, with the undo.
    expect(useUiStore.getState().toasts).toHaveLength(1);
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Rückgängig');
    expect(await undoLast()).toBeDefined();
    await runsSettled();
    expect(undoDepth()).toBe(0);
    expect(await snapshot()).toEqual(before);
    // … and stays undone: the next background run writes nothing.
    const pass = await runBackground({ force: true });
    expect(pass!.rowWrites).toBe(0);
    expect(pass!.writeBacks).toBe(0);
    expect(await snapshot()).toEqual(before);
  });
});

describe('„Nicht planen“ lets the thing go at its source too', () => {
  beforeEach(layFour);

  // Fails on feat/plan-stays-put (reported): `actions.exclude` names no thing for the write-back (`touched`), so
  // the run removes the row but the ToDo keeps the planner's date and mark – a day of a plan it is no part of.
  it('the day the planner wrote on the ToDo goes with the row (the action names the thing)', async () => {
    expect(await taskRepo.get('p1')).toMatchObject({ plannedFor: MON, planMark: { date: MON } });
    expect(await exclude(await entryOf('p1'), {})).toBe(true);
    await runsSettled();
    expect(await assignmentRepo.get(`${key('p1')}#0`)).toBeUndefined();
    const task = (await taskRepo.get('p1')) as { plannedFor?: string; planMark?: unknown };
    expect(task.plannedFor).toBeUndefined();
    expect(task.planMark).toBeUndefined();
  });
});

describe('(b) a week laid by hand', () => {
  const WEEK = [MON, TUE, WED, THU, FRI];
  const laid: Record<string, string> = {};

  beforeEach(async () => {
    for (let i = 0; i < 10; i++) {
      const id = `w${i}`;
      laid[`${key(id)}#0`] = WEEK[i % 5]!;
      await addTask(id, `Woche ${i}`, 60);
      expect(await moveTo(await entryOf(id), WEEK[i % 5]!, {})).toBe(true);
    }
    await runsSettled();
  });

  it('is laid as said: two things on every day, however the engine would have spread them', async () => {
    expect(await rowDates()).toEqual(laid);
    expect((await taskRepo.get('w3'))!.plannedFor).toBe(THU);
  });

  it('two days later a background run moves no row, writes none and tells no ToDo anything; Monday and Tuesday are „Noch offen“', async () => {
    const tasks = (await snapshot()).tasks;
    setNow(() => at(WED, 8).getTime());
    const pass = await runBackground();
    // The day changed, so the pass did happen …
    expect(pass!.ran).toBe(true);
    // … and wrote nothing.
    expect(pass!.rowWrites).toBe(0);
    expect(pass!.writeBacks).toBe(0);
    expect(await rowDates()).toEqual(laid);
    expect((await snapshot()).tasks).toEqual(tasks);
    // The rows of the passed days are neither waiting nor gone: the engine left them alone.
    expect(pass!.result!.kept).toEqual(['w0', 'w1', 'w5', 'w6'].map((id) => `${key(id)}#0`).sort());
    expect(pass!.result!.unplaced).toEqual([]);
    expect(pass!.result!.diff).toMatchObject({ added: [], moved: [], removed: [] });
    // A second pass, a forced one too: still nothing.
    expect((await runBackground())!.ran).toBe(false);
    expect((await runBackground({ force: true }))!.rowWrites).toBe(0);
    expect(await rowDates()).toEqual(laid);

    const board = await boardOn(WED);
    expect(board.open.map((r) => [r.date, r.title])).toEqual([
      [MON, 'Woche 0'],
      [MON, 'Woche 5'],
      [TUE, 'Woche 1'],
      [TUE, 'Woche 6'],
    ]);
    expect(board.days[0]!.date).toBe(WED);
    expect(board.days[0]!.rows.map((r) => r.title).sort()).toEqual(['Woche 2', 'Woche 7']);
    expect(board.days[1]!.rows.map((r) => r.title).sort()).toEqual(['Woche 3', 'Woche 8']);
    expect(board.days[2]!.rows.map((r) => r.title).sort()).toEqual(['Woche 4', 'Woche 9']);
    expect(board.waiting).toEqual([]);
  });

  it('a thing that is „fest“ on a passed day comes first under „Noch offen“ and keeps its lock', async () => {
    expect(await setLocked(await entryOf('w6'), true, {})).toBe(true);
    setNow(() => at(WED, 8).getTime());
    expect((await runBackground())!.rowWrites).toBe(0);
    const board = await boardOn(WED);
    expect(board.open.map((r) => [r.title, r.pinned])).toEqual([
      ['Woche 6', true],
      ['Woche 0', false],
      ['Woche 5', false],
      ['Woche 1', false],
    ]);
    expect((await assignmentRepo.get(`${key('w6')}#0`))?.locked).toBe(true);
  });
});

describe('(c) a background run never tidies', () => {
  beforeEach(layFour);

  it('a source that throws: every row stays stored on its day', async () => {
    const before = await snapshot();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = {
      id: 'todos',
      contributions: {
        plannable: async () => ({
          default: {
            list: async () => {
              throw new Error('boom');
            },
          },
        }),
      },
    } as unknown as ModuleManifest;
    setManifestsForTests(async () => [broken]);
    const pass = await runBackground();
    expect(err).toHaveBeenCalled();
    expect(pass!.ran).toBe(true);
    expect(pass!.inputs.entries).toEqual([]);
    expect(pass!.rowWrites).toBe(0);
    expect(pass!.writeBacks).toBe(0);
    expect(await snapshot()).toEqual(before);
    // The source is back: the plan is as it was, nothing has to be laid again.
    setManifestsForTests(async () => [todos]);
    const back = await runBackground();
    expect(back!.rowWrites).toBe(0);
    expect(back!.result!.unplaced).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it('a thing no source lists any more (its ToDo was deleted): its row stays stored, the board hides it', async () => {
    const before = await rowDates();
    await taskRepo.remove('p3');
    const pass = await runBackground();
    expect(pass!.ran).toBe(true);
    expect(pass!.rowWrites).toBe(0);
    expect(await rowDates()).toEqual(before);
    const board = await boardOn(MON);
    expect(board.days.flatMap((d) => d.rows.map((r) => r.itemKey)).sort()).toEqual(
      ['p1', 'p2', 'p4'].map(key),
    );
  });

  it('a done thing: its row stays stored on its day; reopened it is back there', async () => {
    const before = await rowDates();
    await taskRepo.update('p4', { done: true, completedAt: at(MON).getTime() });
    const pass = await runBackground();
    expect(pass!.ran).toBe(true);
    expect(pass!.rowWrites).toBe(0);
    expect(pass!.writeBacks).toBe(0);
    expect(await rowDates()).toEqual(before);
    expect((await boardOn(MON)).days.flatMap((d) => d.rows.map((r) => r.itemKey))).not.toContain(
      key('p4'),
    );
    await taskRepo.update('p4', { done: false, completedAt: undefined });
    expect((await runBackground())!.rowWrites).toBe(0);
    expect(await rowDates()).toEqual(before);
    const wed = (await boardOn(MON)).days.find((d) => d.date === WED)!;
    expect(wed.rows.map((r) => r.itemKey)).toEqual([key('p4')]);
  });
});

describe('(e) a preview', () => {
  beforeEach(layFour);

  const everything = async () => ({
    days: await db.table('planner_day').toArray(),
    items: await db.table('planner_item').toArray(),
    rows: await db.table('planner_assignment').toArray(),
    tasks: await db.table('todos_task').toArray(),
    settings: await db.table('_settings').toArray(),
    last: await getMeta<LastRun>(LAST_RUN_KEY),
  });
  const sets: [string, PlanOp[]][] = [
    ['a move („schieb X auf Do“)', [{ op: 'pin', key: key('p1'), date: THU }]],
    ['„alles neu mischen“', [{ op: 'replan', reshuffle: true }]],
    [
      'a day off, a blocker, „Nicht planen“, a length and the buffer',
      [
        { op: 'available', date: MON, min: 0 },
        { op: 'block', date: TUE, from: '14:00', to: '16:00', min: 120, label: 'Werkstatt' },
        { op: 'exclude', key: key('p2') },
        { op: 'duration', key: key('p3'), min: 90 },
        { op: 'earliest', key: key('p4'), date: FRI },
        { op: 'buffer', pct: 50 },
      ],
    ],
  ];

  it.each(sets)(
    'of %s writes nothing: no row, no day, no item, no ToDo, no run record, no undo entry',
    async (_n, ops) => {
      const before = await everything();
      const preview = await previewUser(ops);
      await runsSettled();
      expect(preview.result).toBeDefined();
      expect(await everything()).toEqual(before);
      expect(undoDepth()).toBe(0);
      expect(useUiStore.getState().toasts).toEqual([]);
    },
  );

  it('shows the move it would make, and only that one', async () => {
    const preview = await previewUser([{ op: 'pin', key: key('p1'), date: THU }]);
    expect(preview.result.diff.moved).toMatchObject([{ id: `${key('p1')}#0`, from: MON, to: THU }]);
    expect(preview.result.diff.added).toEqual([]);
    expect(preview.result.diff.removed).toEqual([]);
    // A day off moves nothing off that day.
    const off = await previewUser([{ op: 'available', date: MON, min: 0 }]);
    expect(off.result.diff).toMatchObject({ added: [], moved: [], removed: [] });
  });
});
