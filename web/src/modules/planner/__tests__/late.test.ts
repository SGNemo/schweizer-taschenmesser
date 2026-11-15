/**
 * „Frist vorbei“ (planner hub R2, D7): money past its hard deadline leaves the days – in the run (it is no item
 * of the engine), on the board (its own list, no day sum), for „Rest verteilen“ and every sentence (they never
 * see it) and in the head (rule 3). A late chore stays on its day.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { PlannableEntry } from '@/core/modules/contributions';
import { parseInstruction, restToTomorrow } from '@/core/plan/instructions';
import type { Unplaced } from '@/core/plan/types';
import { buildBoard, type BoardInput } from '../board';
import { plannerHead } from '../head';
import { lateMoneyDue } from '../late';
import { assignmentRepo, itemRepo } from '../repo';
import { buildInputs, runPlanner, type RunDeps } from '../run';
import { plannerRepos } from '../repo';
import { duesOf } from '../rest';
import { instructionItems } from '../say';
import type { AssignmentRow, PlanItemRow } from '../schema';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const SUN = '2026-11-15'; // today
const MON = '2026-11-16';
const TUE = '2026-11-17';
const H = { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const };

const entry = (
  moduleId: string,
  id: string,
  kind: string,
  over: Partial<PlannableEntry> = {},
): PlannableEntry => ({
  moduleId,
  id,
  kind,
  title: id,
  to: `/${moduleId}?open=${id}`,
  durationMin: 10,
  createdAt: 1,
  ...over,
});

/** Two invoices and a cancellation past their date, an invoice due on Friday, a ToDo whose hard date has passed. */
const lateA = entry('invoices', 'zahnarzt', 'invoice', {
  due: { date: '2026-11-12', hard: true },
  createdAt: 2,
});
const lateB = entry('invoices', 'tischler', 'invoice', {
  due: { date: '2026-11-10', hard: true },
});
const lateCancel = entry('subscriptions', 'musik:2026-11-14', 'cancel', {
  due: { date: '2026-11-14', hard: true },
});
const onTime = entry('invoices', 'strom', 'invoice', { due: { date: '2026-11-20', hard: true } });
const chore = entry('todos', 'steuer', 'task', {
  due: { date: '2026-11-10', hard: true },
  durationMin: 35,
});
const plain = entry('todos', 'saugen', 'task', { durationMin: 30 });
const ENTRIES = [lateA, lateB, lateCancel, onTime, chore, plain];
const key = (e: PlannableEntry) => `${e.moduleId}:${e.id}`;

const assignment = (
  e: PlannableEntry,
  date: string,
  order: number,
): AssignmentRow & { id: string } => ({
  id: `${key(e)}#0`,
  itemKey: key(e),
  k: 0,
  of: 1,
  date,
  minutes: e.durationMin ?? 30,
  order,
  reason: 'new',
});

const input = (over: Partial<BoardInput> = {}): BoardInput => ({
  today: SUN,
  span: 7,
  settings: H,
  dayRows: [],
  itemRows: [],
  // What a run before R2 stored: everything on Monday.
  assignments: ENTRIES.map((e, i) => assignment(e, MON, i)),
  entries: ENTRIES,
  calendar: [],
  unplaced: [],
  ...over,
});

describe('lateMoneyDue: which thing is „Frist vorbei“', () => {
  it('an invoice or a cancellation whose hard date is before today; never one of today or later', () => {
    expect(lateMoneyDue(lateA, undefined, SUN)).toBe('2026-11-12');
    expect(lateMoneyDue(lateCancel, undefined, SUN)).toBe('2026-11-14');
    expect(lateMoneyDue(onTime, undefined, SUN)).toBeUndefined();
    expect(
      lateMoneyDue({ ...lateA, due: { date: SUN, hard: true } }, undefined, SUN),
    ).toBeUndefined();
  });

  it('a chore is never money, however late; a soft date and a done thing do not count', () => {
    expect(lateMoneyDue(chore, undefined, SUN)).toBeUndefined();
    expect(
      lateMoneyDue({ ...lateA, due: { date: '2026-11-12', hard: false } }, undefined, SUN),
    ).toBeUndefined();
    expect(lateMoneyDue({ ...lateA, done: true }, undefined, SUN)).toBeUndefined();
  });
});

describe('board: late money leaves the days and their sums', () => {
  it('lists late money in its own group, oldest deadline first, and takes it off its day at once', () => {
    const board = buildBoard(input());
    expect(board.late.map((r) => [r.itemKey, r.hardDue])).toEqual([
      ['invoices:tischler', '2026-11-10'],
      ['invoices:zahnarzt', '2026-11-12'],
      ['subscriptions:musik:2026-11-14', '2026-11-14'],
    ]);
    const monday = board.days[1]!;
    expect(monday.rows.map((r) => r.itemKey)).toEqual([
      'invoices:strom',
      'todos:steuer',
      'todos:saugen',
    ]);
    // Monday's sum, free time and load count what is on the day: 10 + 35 + 30 of 192 usable minutes.
    expect(monday.planned).toBe(75);
    expect(monday.free).toBe(192 - 75);
    expect(monday.over).toBe(0);
    for (const day of board.days)
      expect(day.rows.some((r) => board.late.some((l) => l.itemKey === r.itemKey))).toBe(false);
  });

  it('a late chore stays on its day and says „Frist war …“ there', () => {
    const board = buildBoard(input());
    const row = board.days[1]!.rows.find((r) => r.itemKey === 'todos:steuer')!;
    expect(row.hardDue).toBe('2026-11-10');
    expect(board.late.some((r) => r.itemKey === 'todos:steuer')).toBe(false);
  });

  it('late money is never part of what waits – not as an unplaced thing either', () => {
    const unplaced: Unplaced[] = [
      {
        id: 'invoices:zahnarzt#0',
        itemKey: 'invoices:zahnarzt',
        k: 0,
        of: 1,
        minutes: 10,
        reason: 'horizon',
      },
      {
        id: 'todos:saugen#0',
        itemKey: 'todos:saugen',
        k: 0,
        of: 1,
        minutes: 30,
        reason: 'horizon',
      },
    ];
    const board = buildBoard(input({ assignments: [], unplaced }));
    expect(board.waiting.map((w) => w.itemKey)).toEqual(['todos:saugen']);
    expect(board.late).toHaveLength(3);
  });

  it('„Nicht planen“ takes a late invoice out of the group; it waits as „nicht im Plan“, as before', () => {
    const itemRows: (PlanItemRow & { id: string })[] = [
      {
        id: 'invoices:zahnarzt',
        source: { module: 'invoices', id: 'zahnarzt' },
        excluded: true,
        order: 0,
      },
    ];
    const board = buildBoard(input({ itemRows }));
    expect(board.late.map((r) => r.itemKey)).not.toContain('invoices:zahnarzt');
    expect(board.waiting).toEqual([
      expect.objectContaining({ itemKey: 'invoices:zahnarzt', reason: 'excluded' }),
    ]);
    expect(board.days[1]!.rows.some((r) => r.itemKey === 'invoices:zahnarzt')).toBe(false);
  });

  it('no late money: an empty group', () => {
    expect(buildBoard(input({ entries: [onTime, chore, plain] })).late).toEqual([]);
  });
});

describe('„Rest verteilen“ and sentences leave the group alone', () => {
  // Monday is today here: the three late things were due before it, the rest sits on Monday.
  const board = buildBoard(input({ today: MON }));

  it('the rules never see late money: no item, no deadline in the preview', () => {
    const items = instructionItems(board);
    expect(items.map((i) => i.key).sort()).toEqual([
      'invoices:strom',
      'todos:saugen',
      'todos:steuer',
    ]);
    expect(Object.keys(duesOf(board)).sort()).toEqual(['invoices:strom', 'todos:steuer']);
  });

  it('`restToTomorrow` and „alles von Di nach Mi“ move only what is on the day', () => {
    const ctx = { today: MON, items: instructionItems(board) };
    const moved = (ops: ReturnType<typeof restToTomorrow>) =>
      ops.flatMap((o) => (o.op === 'earliest' ? [o.key] : [])).sort();
    expect(moved(restToTomorrow(ctx))).toEqual(['invoices:strom', 'todos:saugen']);
    // The same things on Tuesday (as a run before R2 would have left them), said as a sentence.
    const tuesday = buildBoard(
      input({ today: MON, assignments: ENTRIES.map((e, i) => assignment(e, TUE, i)) }),
    );
    const said = parseInstruction('alles von Di nach Mi', {
      today: MON,
      items: instructionItems(tuesday),
    });
    expect(said.kind).toBe('ops');
    if (said.kind === 'ops') {
      expect(moved(said.ops)).toEqual(['invoices:strom', 'todos:saugen']);
      expect(JSON.stringify(said.ops)).not.toMatch(/zahnarzt|tischler|musik/);
    }
  });

  it('a sentence that names a late invoice finds no thing to move', () => {
    const said = parseInstruction('schieb zahnarzt auf Mi', {
      today: MON,
      items: instructionItems(board),
    });
    expect(said.kind).not.toBe('ops');
  });
});

describe('the run: late money is no item of the engine', () => {
  const tables = ['planner_day', 'planner_item', 'planner_assignment', '_settings', '_meta'];
  beforeEach(async () => {
    for (const t of tables) await db.table(t).clear();
  });
  const writer = () => ({
    onAssign: vi.fn(async () => undefined),
    onRelease: vi.fn(async () => undefined),
  });
  const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
    today: SUN,
    manifests: [],
    settings: H,
    planLimit: 3,
    settled: true,
    entries: ENTRIES,
    calendar: [],
    writer: writer(),
    ...over,
  });

  it('places everything but late money, and no day carries its minutes', async () => {
    const r = await runPlanner(deps());
    expect(r.ran).toBe(true);
    const placed = new Set(r.result!.assignments.map((a) => a.itemKey));
    expect([...placed].sort()).toEqual(['invoices:strom', 'todos:saugen', 'todos:steuer']);
    // (The late chore is noted as placed after its date – money past its date is not noted at all.)
    expect(r.result!.unplaced.map((u) => u.itemKey)).toEqual(['todos:steuer']);
    expect(r.result!.demandMin).toBe(75);
    expect(r.inputs.items.map((i) => i.key).sort()).toEqual([
      'invoices:strom',
      'todos:saugen',
      'todos:steuer',
    ]);
    // Titles stay known (the preview and „Warum hier?“ name a thing that left).
    expect(r.inputs.titles['invoices:zahnarzt']).toBe('zahnarzt');
  });

  it('drops the rows an earlier run stored for it, once; the next run writes nothing (idempotent)', async () => {
    // Yesterday the invoices were still on Monday.
    for (const [i, e] of ENTRIES.entries()) {
      const { id, ...row } = assignment(e, MON, i);
      await assignmentRepo.upsert(id, row);
    }
    const first = await runPlanner(deps());
    expect(first.ran).toBe(true);
    const left = (await assignmentRepo.active().toArray()).map((a) => a.itemKey).sort();
    expect(left).toEqual(['invoices:strom', 'todos:saugen', 'todos:steuer']);
    const again = await runPlanner(deps());
    expect(again.ran).toBe(false);
    expect(again.rowWrites).toBe(0);
    const forced = await runPlanner(deps(), { force: true });
    expect(forced.rowWrites).toBe(0);
    expect((await assignmentRepo.active().toArray()).map((a) => a.itemKey).sort()).toEqual(left);
  });

  it('the input hash changes when a deadline passes, so that run happens without a user action', async () => {
    const repos = plannerRepos();
    const friday = { ...lateA, due: { date: '2026-11-20', hard: true } };
    const before = await buildInputs(deps({ entries: [friday, plain] }), repos);
    const after = await buildInputs(deps({ entries: [lateA, plain] }), repos);
    expect(after.hash).not.toBe(before.hash);
  });

  it('a mark the planner left on such a source is handed back through the write-back, a user’s date is not copied', async () => {
    const w = writer();
    const marked = {
      ...lateA,
      plannedFor: MON,
      planMark: { date: MON, order: 0 },
    };
    const r = await runPlanner(deps({ entries: [marked, plain], writer: w }));
    expect(w.onAssign).toHaveBeenCalledWith('invoices', 'zahnarzt', undefined);
    expect(r.inputs.userDates.has('invoices:zahnarzt')).toBe(false);
    // The second run finds the same input: nothing more is written.
    w.onAssign.mockClear();
    expect((await runPlanner(deps({ entries: [lateA, plain], writer: w }))).ran).toBe(false);
    expect(w.onAssign).not.toHaveBeenCalled();
  });

  it('a pin stored for it places nothing and survives: it holds again once the deadline is moved ahead', async () => {
    await itemRepo.upsert('invoices:zahnarzt', {
      source: { module: 'invoices', id: 'zahnarzt' },
      pinned: TUE,
      order: 0,
    });
    const late = await runPlanner(deps({ entries: [lateA, plain] }));
    expect(late.result!.assignments.some((a) => a.itemKey === 'invoices:zahnarzt')).toBe(false);
    expect((await itemRepo.get('invoices:zahnarzt'))?.pinned).toBe(TUE);
    const friday = { ...lateA, due: { date: '2026-11-20', hard: true } };
    const ahead = await runPlanner(deps({ entries: [friday, plain] }));
    expect(ahead.result!.assignments.find((a) => a.itemKey === 'invoices:zahnarzt')?.date).toBe(
      TUE,
    );
  });
});

describe('head rule 3: only late money', () => {
  const free = (date: string, isToday = false) => ({ date, isToday, free: 0, over: 0, rows: [] });

  it('„Heute ist frei.“ with the group named in the context; other kinds are counted as things', () => {
    const board = buildBoard(input({ entries: [lateA, lateB], assignments: [] }));
    expect(plannerHead(board.days, { late: board.late })).toEqual({
      value: 'Heute ist frei.',
      detail: 'Frist vorbei: 2 Rechnungen',
    });
    const one = buildBoard(input({ entries: [lateA], assignments: [] }));
    expect(plannerHead(one.days, { late: one.late })!.detail).toBe('Frist vorbei: 1 Rechnung');
    const mixed = buildBoard(input({ entries: [lateA, lateCancel], assignments: [] }));
    expect(plannerHead(mixed.days, { late: mixed.late })!.detail).toBe('Frist vorbei: 2 Dinge');
  });

  it('a day with things wins (rules 1 and 2); nothing at all is still no figure (rule 4)', () => {
    const board = buildBoard(input());
    expect(plannerHead(board.days, { late: board.late })!.detail).toBe(
      'morgen, Mo. 16. · heute ist frei',
    );
    expect(plannerHead([free(SUN, true), free(MON)], { late: [] })).toBeUndefined();
    expect(plannerHead([free(SUN, true), free(MON)])).toBeUndefined();
  });
});
