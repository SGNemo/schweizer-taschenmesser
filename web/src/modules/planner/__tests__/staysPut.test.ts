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
  allToday,
  layHere,
  moveMany,
  moveTo,
  setAvailable,
  setLocked,
  spreadDay,
  spreadOpen,
  takeOff,
} from '../actions';
import { buildBoard } from '../board';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { LAST_RUN_KEY, type LastRun } from '../run';
import {
  previewUser,
  proposeUser,
  runBackground,
  runsSettled,
  setManifestsForTests,
} from '../services';
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
  /** State the case needs besides the four laid things (written before the snapshot, no undo entry). */
  prep?: () => Promise<void>;
  /** The named things land on this day or a later one (a proposal picks the day). */
  toAtLeast?: string;
}

/** Package 3: Wednesday morning – Monday's and Tuesday's things are „Noch offen“. */
const onWednesday = async () => {
  setNow(() => at(WED, 8).getTime());
};

/** Package 2: the proposal a chip showed (read in `prep`, taken by the case). */
let proposed: string | undefined;
const lastToast = () => useUiStore.getState().toasts.at(-1)?.message;
const lockRow = async (id: string) => {
  await assignmentRepo.update(`${key(id)}#0`, { locked: true } as never);
};

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
      expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Fest am Di');
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
  // Package 2 (planner rethink): the lock on the row, the lock words, the chips – each names one thing.
  {
    name: 'the lock on the row, off again („Nicht mehr fest“)',
    prep: () => lockRow('p3'),
    run: async () => setLocked(await entryOf('p3'), false, {}),
    named: ['p3'],
    did: async () => {
      expect((await assignmentRepo.get(`${key('p3')}#0`))?.locked).toBeUndefined();
      expect(lastToast()).toBe('Nicht mehr fest');
    },
  },
  {
    name: 'moveTo of a thing that is „fest“: the lock moves with it, the toast says so',
    prep: () => lockRow('p1'),
    run: async () => moveTo(await entryOf('p1'), THU, {}),
    named: ['p1'],
    to: THU,
    did: async () => {
      expect((await assignmentRepo.get(`${key('p1')}#0`))?.locked).toBe(true);
      expect(lastToast()).toBe('Ding p1 liegt auf Do · fest');
    },
  },
  {
    name: 'addFromField with a lock word after a day („Zahnarzt Do fest“)',
    run: () => addFromField('Zahnarzt Do fest', {}, TUE),
    named: ['new'],
    to: THU,
    did: async () => {
      const [row] = (await assignmentRepo.active().toArray()).filter((r) => r.date === THU);
      expect(row?.locked).toBe(true);
      const task = (await taskRepo.active().toArray()).find((x) => !(x.id in LAID))!;
      expect(task.title).toBe('Zahnarzt');
      expect(lastToast()).toBe('Zahnarzt liegt auf Do · fest');
    },
  },
  {
    name: 'addFromField with „!“ after a date („Steuer 20.11.!“)',
    run: () => addFromField('Steuer 20.11.!', {}, TUE),
    named: ['new'],
    to: FRI,
    did: async () => {
      const row = (await assignmentRepo.active().toArray()).find((r) => r.date === FRI);
      expect(row?.locked).toBe(true);
    },
  },
  {
    name: 'addFromField with a lock word and no day („Bin fest“): a title, laid on the sheet, not fest',
    run: () => addFromField('Bin fest', {}, TUE),
    named: ['new'],
    to: TUE,
    did: async () => {
      const task = (await taskRepo.active().toArray()).find((x) => !(x.id in LAID))!;
      expect(task.title).toBe('Bin fest');
      expect((await assignmentRepo.active().toArray()).some((r) => r.locked)).toBe(false);
    },
  },
  {
    name: 'addFromField with a lock word after a deadline („Steuer bis Fr fest“): the deadline stays, nothing is fest',
    run: () => addFromField('Steuer bis Fr fest', {}, TUE),
    named: ['new'],
    to: TUE,
    did: async () => {
      expect((await assignmentRepo.active().toArray()).some((r) => r.locked)).toBe(false);
      const task = (await taskRepo.active().toArray()).find((x) => !(x.id in LAID))!;
      expect((await itemRepo.get(key(task.id)))?.due).toMatchObject({ date: FRI, hard: true });
    },
  },
  {
    name: 'addFromField with the `p` prefix keeps its pin („p Zahnarzt Donnerstag“, ANALYSIS R13)',
    run: () => addFromField('p Zahnarzt Donnerstag', {}, TUE),
    named: ['new'],
    to: THU,
    did: async () => {
      const row = (await assignmentRepo.active().toArray()).find((r) => r.date === THU);
      expect(row?.locked).toBe(true);
    },
  },
  {
    name: '„Hierher legen“ of a date set in ToDos',
    prep: async () => {
      await addTask('p5', 'Arzt anrufen');
      await taskRepo.update('p5', { plannedFor: FRI } as never);
      // The muted row stands on Friday and counts for nothing; the thing is not „Noch ohne Tag“ as well.
      const fri = (await boardOn(MON)).days.find((d) => d.date === FRI)!;
      expect(fri.hints?.map((h) => h.itemKey)).toEqual([key('p5')]);
      expect(fri.planned).toBe(0);
    },
    run: async () => layHere(await entryOf('p5'), FRI, {}),
    named: ['p5'],
    to: FRI,
    did: async () => {
      const fri = (await boardOn(MON)).days.find((d) => d.date === FRI)!;
      expect(fri.hints).toEqual([]);
      expect(fri.rows.map((r) => r.itemKey)).toEqual([key('p5')]);
      expect(lastToast()).toBe('Liegt auf Fr');
    },
  },
  {
    name: '„Übernehmen“ of a chip „Vorschlag: … · Frist Fr“',
    prep: async () => {
      await addTask('p6', 'Rechnung prüfen', 60);
      await itemRepo.create(
        {
          source: { module: 'todos', id: 'p6' },
          order: 0,
          due: { date: FRI, hard: true },
        } as never,
        { id: key('p6') },
      );
      proposed = (await proposeUser([key('p6')]))[key('p6')];
      expect(proposed).toBeDefined();
    },
    run: async () => layHere(await entryOf('p6'), proposed!, {}),
    named: ['p6'],
    get to() {
      return proposed;
    },
    did: async () => {
      expect((await assignmentRepo.get(`${key('p6')}#0`))?.locked).toBeUndefined();
    },
  },
  {
    // Monday keeps 30 min of time (24 usable): p1 and p2 (30 min each) overbook it; p2 is „fest“.
    name: '„Rest verteilen“ of an overbooked day: the free thing goes, the fixed one stays and is named',
    prep: async () => {
      await dayRepo.create({ date: MON, availableMin: 30, blockers: [] } as never, { id: MON });
      await lockRow('p2');
      expect((await boardOn(MON)).days[0]!.over).toBe(36);
    },
    run: () => spreadDay(MON, [key('p1')], 1, {}),
    named: ['p1'],
    to: TUE,
    did: async () => {
      expect(await assignmentRepo.get(`${key('p2')}#0`)).toMatchObject({ date: MON, locked: true });
      expect(lastToast()).toBe('Verteilt.\n1 bleibt: fest');
    },
  },
  // Package 3 (planner rethink): the tab „Noch offen“ in one move – each action names its things, one undo.
  {
    name: '„Alle auf heute“ of the tab „Noch offen“',
    prep: onWednesday,
    run: async () => allToday([await entryOf('p1'), await entryOf('p2'), await entryOf('p3')], {}),
    named: ['p1', 'p2', 'p3'],
    to: WED,
    did: async () => {
      expect(lastToast()).toBe('Alles liegt auf heute.');
      expect((await boardOn(WED)).open).toEqual([]);
    },
  },
  {
    name: '„Auf einen Tag …“ of a selection (two things onto Friday)',
    prep: onWednesday,
    run: async () => moveMany([await entryOf('p1'), await entryOf('p2')], FRI, {}),
    named: ['p1', 'p2'],
    to: FRI,
    did: async () => {
      expect(lastToast()).toBe('2 Dinge liegen auf Fr');
      expect((await boardOn(WED)).open.map((r) => r.itemKey)).toEqual([key('p3')]);
    },
  },
  {
    name: '„Verteilen …“ of the tab „Noch offen“: the open things go to today or later, the fixed one stays',
    prep: async () => {
      await onWednesday();
      await lockRow('p2');
    },
    run: () => spreadOpen([key('p1'), key('p2'), key('p3')], 0, {}),
    named: ['p1', 'p3'],
    toAtLeast: WED,
    did: async () => {
      expect(await assignmentRepo.get(`${key('p2')}#0`)).toMatchObject({ date: MON, locked: true });
      expect(lastToast()).toBe('Verteilt.\n1 bleibt: fest');
    },
  },
  {
    name: "„Vom Tag nehmen“: the thing is „Noch ohne Tag“ again, its ToDo loses the planner's date",
    prep: onWednesday,
    run: async () => takeOff(await entryOf('p1'), {}),
    named: ['p1'],
    to: null,
    did: async () => {
      expect(lastToast()).toBe('Ding p1 ist jetzt ohne Tag');
      const task = (await taskRepo.get('p1')) as { plannedFor?: string; planMark?: unknown };
      expect(task.planMark).toBeUndefined();
    },
  },
];

describe.each(cases)('$name', (c) => {
  const { run, named, did, prep } = c;
  // Read when the test runs (a chip's proposed day is known only after `prep`).
  const to = () => c.to;
  beforeEach(layFour);
  /** The item keys the action named, the new thing included. */
  const namedKeys = async () => {
    const fresh = (await taskRepo.active().toArray())
      .map((x) => x.id)
      .filter((id) => !(id in LAID));
    return new Set(named.flatMap((id) => (id === 'new' ? fresh : [id])).map(key));
  };

  it('(a) only the rows of the named thing change their day; no other row disappears or appears', async () => {
    await prepare(prep);
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
      if (to() === null) expect(after[id]).toBeUndefined();
      else if (c.toAtLeast) expect(after[id]! >= c.toAtLeast, `${id} on ${after[id]}`).toBe(true);
      else expect(after[id]).toBe(to() ?? before[id]);
    }
    await did();
  });

  it('(d) is exactly one undo entry, and the undo restores the rows', async () => {
    await prepare(prep);
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

/** A case's own state, then a clean journal: the case's action is the one undo entry. */
async function prepare(prep?: () => Promise<void>) {
  if (!prep) return;
  await prep();
  await runsSettled();
  resetUndoJournal();
  useUiStore.setState({ toasts: [] });
}

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

describe('package 2: chips and muted rows are derived, never stored', () => {
  beforeEach(layFour);

  const everything = async () => ({
    days: await db.table('planner_day').toArray(),
    items: await db.table('planner_item').toArray(),
    rows: await db.table('planner_assignment').toArray(),
    tasks: await db.table('todos_task').toArray(),
    last: await getMeta<LastRun>(LAST_RUN_KEY),
  });
  /** A thing without a day with a hard deadline: it gets a chip. */
  const deadline = async (id: string, minutes: number, due: string) => {
    await addTask(id, `Frist ${id}`, minutes);
    await itemRepo.create(
      { source: { module: 'todos', id }, order: 0, due: { date: due, hard: true } } as never,
      { id: key(id) },
    );
  };

  it('the chips („Vorschlag“) and the muted rows („In ToDos“) write nothing: no row, no ToDo, no undo entry', async () => {
    await deadline('d1', 60, FRI);
    await addTask('d2', 'Datiert');
    await taskRepo.update('d2', { plannedFor: THU } as never);
    await runsSettled();
    resetUndoJournal();
    const before = await everything();
    const days = await proposeUser([key('d1')]);
    expect(days[key('d1')]).toBeDefined();
    const thu = (await boardOn(MON)).days.find((d) => d.date === THU)!;
    expect(thu.hints?.map((h) => h.title)).toEqual(['Datiert']);
    // A muted row counts for no load.
    expect(thu.planned).toBe(0);
    await runsSettled();
    expect(await everything()).toEqual(before);
    expect(undoDepth()).toBe(0);
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('two deadline things never get the same place: one dry run over both', async () => {
    // Monday keeps 132 free minutes, Tuesday and Wednesday 162: neither 150-minute thing fits on Monday, one each on
    // Tuesday and Wednesday. Asked one at a time, both would have been offered Tuesday.
    await deadline('d1', 150, FRI);
    await deadline('d2', 150, FRI);
    const alone = [
      (await proposeUser([key('d1')]))[key('d1')],
      (await proposeUser([key('d2')]))[key('d2')],
    ];
    expect(alone).toEqual([TUE, TUE]);
    const both = await proposeUser([key('d1'), key('d2')]);
    expect(Object.values(both).sort()).toEqual([TUE, WED]);
  });

  it('a date set in ToDos before today shows as a chip under „Noch ohne Tag“, not on a day', async () => {
    await addTask('d3', 'Alt datiert');
    await taskRepo.update('d3', { plannedFor: '2026-11-12' } as never);
    await runBackground({ force: true });
    const board = await boardOn(MON);
    expect(board.days.flatMap((d) => d.hints ?? [])).toEqual([]);
    expect(board.waiting.find((w) => w.itemKey === key('d3'))?.todoDate).toBe('2026-11-12');
  });
});

describe('package 2: a dated turn of its source (`PlannableItem.day`)', () => {
  beforeEach(layFour);

  it('shows on its day without a row and counts there; locking it writes its row, one undo', async () => {
    await addTask('t1', 'Training');
    const listed = await entryOf('t1');
    const turn: PlannableEntry = { ...listed, day: THU };
    const board = buildBoard({
      today: MON,
      span: 7,
      settings: DEFAULT_PLANNER_SETTINGS,
      dayRows: [],
      itemRows: [],
      assignments: await assignmentRepo.active().toArray(),
      entries: [turn],
      calendar: [],
      unplaced: [
        { id: `${key('t1')}#0`, itemKey: key('t1'), k: 0, of: 1, minutes: 30, reason: 'no-day' },
      ],
    });
    const thu = board.days.find((d) => d.date === THU)!;
    expect(thu.rows).toMatchObject([{ itemKey: key('t1'), derived: true, pinned: false }]);
    expect(thu.planned).toBe(30);
    expect(board.waiting).toEqual([]);
    expect(await assignmentRepo.get(`${key('t1')}#0`)).toBeUndefined();

    const before = await rowDates();
    expect(await setLocked(turn, true, {}, THU)).toBe(true);
    await runsSettled();
    expect(undoDepth()).toBe(1);
    expect(await assignmentRepo.get(`${key('t1')}#0`)).toMatchObject({ date: THU, locked: true });
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Fest am Do');
    expect(await rowDates()).toEqual({ ...before, [`${key('t1')}#0`]: THU });
    await undoLast();
    await runsSettled();
    expect(await rowDates()).toEqual(before);
  });
});

describe('package 2: a proposal that finds no room says so after „Übernehmen“', () => {
  beforeEach(layFour);

  it('„Rest verteilen“ with a thing longer than any day: it stays where it lies, the toast names it', async () => {
    await taskRepo.update('p1', { estimateMin: 480 } as never);
    // Every day keeps 2 h (96 min usable): 8 h fit nowhere.
    for (const d of [
      MON,
      TUE,
      WED,
      THU,
      FRI,
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ])
      await dayRepo.create({ date: d, availableMin: 120, blockers: [] } as never, { id: d });
    await assignmentRepo.update(`${key('p1')}#0`, { minutes: 480 } as never);
    await runsSettled();
    resetUndoJournal();
    useUiStore.setState({ toasts: [] });
    const before = await rowDates();
    expect(await spreadDay(MON, [key('p1')], 0, {})).toBe(true);
    await runsSettled();
    expect(await rowDates()).toEqual(before);
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Verteilt.\n1 bleibt, wo es liegt: kein Platz',
    );
    // Nothing was written, so there is nothing to undo (and the toast offers no undo).
    expect(undoDepth()).toBe(0);
    expect(useUiStore.getState().toasts.at(-1)?.action).toBeUndefined();
  });
});

describe('package 2: a dated turn takes its day for every proposal and is never written', () => {
  beforeEach(layFour);

  it('a background run writes no row for it; a chip does not claim its time; a reshuffle does not move it', async () => {
    const turns = {
      id: 'routines',
      contributions: {
        plannable: async () => ({
          default: {
            list: async () => [
              {
                id: 'bad',
                kind: 'routine',
                title: 'Bad putzen',
                to: '/routines',
                durationMin: 150,
                day: TUE,
              },
            ],
          },
        }),
      },
    } as unknown as ModuleManifest;
    setManifestsForTests(async () => [todos, turns]);
    const before = await rowDates();
    const pass = await runBackground({ force: true });
    expect(pass!.rowWrites).toBe(0);
    expect(await rowDates()).toEqual(before);
    expect(pass!.inputs.turns).toEqual([{ id: 'routines:bad#0', date: TUE, reason: 'kept' }]);
    // Tuesday holds p3 (30) and the turn (150) of its 192 minutes: a 60-minute deadline thing is not offered Tuesday.
    await addTask('d1', 'Frist d1', 60);
    await itemRepo.create(
      { source: { module: 'todos', id: 'd1' }, order: 0, due: { date: FRI, hard: true } } as never,
      { id: key('d1') },
    );
    const offered = (await proposeUser([key('d1')]))[key('d1')];
    expect(offered).toBe(MON);
    const preview = await previewUser([{ op: 'replan', reshuffle: true }]);
    expect(preview.result.assignments.find((a) => a.itemKey === 'routines:bad')?.date).toBe(TUE);
    await runsSettled();
    expect(await assignmentRepo.get('routines:bad#0')).toBeUndefined();
  });
});

describe('package 2, council round 2', () => {
  beforeEach(layFour);

  const routine = (day: string) =>
    ({
      id: 'routines',
      contributions: {
        plannable: async () => ({
          default: {
            list: async () => [
              {
                id: 'bad',
                kind: 'routine',
                title: 'Bad putzen',
                to: '/routines',
                durationMin: 30,
                day,
              },
            ],
          },
        }),
      },
    }) as unknown as ModuleManifest;

  it('a turn beyond the board’s days is listed with its day, not lost', async () => {
    const later = '2026-11-26';
    const board = buildBoard({
      today: MON,
      span: 7,
      settings: DEFAULT_PLANNER_SETTINGS,
      dayRows: [],
      itemRows: [],
      assignments: [],
      entries: [
        {
          moduleId: 'routines',
          id: 'bad',
          kind: 'routine',
          title: 'Bad putzen',
          to: '/',
          day: later,
        },
      ],
      calendar: [],
      unplaced: [],
    });
    expect(board.waiting).toMatchObject([
      { itemKey: 'routines:bad', reason: 'later', date: later },
    ]);
  });

  it('a sentence move of a turn: the preview shows the move the apply makes', async () => {
    setManifestsForTests(async () => [todos, routine(TUE)]);
    const preview = await previewUser([{ op: 'pin', key: 'routines:bad', date: THU }]);
    expect(preview.result.assignments.find((a) => a.itemKey === 'routines:bad')?.date).toBe(THU);
  });

  it('„Übernehmen“ of a spread hands over only what still lies unlocked on that day', async () => {
    // The preview named p1 and p2; meanwhile p2 was locked on another device.
    await lockRow('p2');
    await runsSettled();
    resetUndoJournal();
    expect(await spreadDay(MON, [key('p1'), key('p2')], 0, {})).toBe(true);
    await runsSettled();
    expect(await assignmentRepo.get(`${key('p2')}#0`)).toMatchObject({ date: MON, locked: true });
  });
});
