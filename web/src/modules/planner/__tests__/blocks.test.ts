/**
 * Planner hub S4: a fixed block (`PlannableItem.fixed`, a training at 18:00) and time a module keeps free
 * (`PlannableSource.blocks`, a habit) move things – both enter the run's input hash; the board counts them as the
 * engine does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { PlanBlockEntry, PlannableEntry } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { setNow } from '@/core/time/now';
import { restToTomorrow } from '@/core/plan/instructions';
import { buildBoard } from '../board';
import { assignmentRepo } from '../repo';
import { runPlanner, type RunDeps } from '../run';
import { instructionItems, restIsEmpty } from '../say';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const TODAY = '2026-11-09'; // Monday
const TUE = '2026-11-10';
const H = { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const };
const writer = { onAssign: vi.fn(async () => undefined), onRelease: vi.fn(async () => undefined) };

const training = (over: Partial<PlannableEntry> = {}): PlannableEntry => ({
  moduleId: 'fitness',
  id: 's1',
  kind: 'training',
  title: 'Training: Oberkörper',
  to: '/fitness?open=s1',
  durationMin: 60,
  earliest: TUE,
  fixed: { from: '18:00' },
  createdAt: 1,
  ...over,
});
const todo = (id: string, min: number): PlannableEntry => ({
  moduleId: 'todos',
  id,
  kind: 'task',
  title: id,
  to: `/todos?open=${id}`,
  durationMin: min,
  priority: 1,
  createdAt: 2,
});
const walk = (date: string, min = 30): PlanBlockEntry => ({
  moduleId: 'habits',
  id: `g1:${date}`,
  date,
  label: 'Spazieren gehen',
  min,
});
const deps = (entries: PlannableEntry[], blocks: PlanBlockEntry[] = []): RunDeps => ({
  today: TODAY,
  manifests: [],
  settings: H,
  planLimit: 3,
  settled: true,
  entries,
  blocks,
  calendar: [],
  writer,
});

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
  for (const t of ['planner_day', 'planner_item', 'planner_assignment', '_meta'])
    await db.table(t).clear();
});
afterEach(() => setNow());

describe('the run with fixed blocks and module blocks', () => {
  it('places the training at its time on its day; a rerun writes nothing', async () => {
    const r = await runPlanner(deps([training(), todo('a', 30)]));
    expect(r.result?.assignments.find((a) => a.itemKey === 'fitness:s1')).toMatchObject({
      date: TUE,
      from: '18:00',
      to: '19:00',
      order: 0,
    });
    const again = await runPlanner(deps([training(), todo('a', 30)]));
    expect(again.ran).toBe(false);
    expect(again.rowWrites).toBe(0);
  });

  it('a changed time, a new block or a changed goal length changes the hash and replans', async () => {
    const hash = async (e: PlannableEntry[], b: PlanBlockEntry[] = []) =>
      (await runPlanner(deps(e, b))).inputs.hash;
    const base = await hash([training()]);
    expect(await hash([training({ fixed: { from: '19:00' } })])).not.toBe(base);
    expect(await hash([training({ fixed: undefined })])).not.toBe(base);
    expect(await hash([training()], [walk(TODAY)])).not.toBe(base);
    expect(await hash([training()], [walk(TODAY, 15)])).not.toBe(
      await hash([training()], [walk(TODAY)]),
    );
    expect(await hash([training()])).toBe(base);
  });

  it('moving an appointment that overlaps the training reruns and charges the training again', async () => {
    const appt = (time: string, endTime: string): CalendarItem => ({
      id: 'e1',
      source: 'calendar',
      kind: 'event',
      title: 'Teamrunde',
      date: TUE,
      time,
      endTime,
      allDay: false,
      to: '/calendar',
    });
    const withCal = (cal: CalendarItem[], entries = [training(), todo('a', 30)]): RunDeps => ({
      ...deps(entries),
      settings: { ...H, calendarBlocks: true },
      calendar: cal,
    });
    const first = await runPlanner(withCal([appt('18:00', '19:00')]));
    // The appointment covers the whole training: it takes nothing more from Tuesday.
    expect(first.result!.load[TUE]!.planned).toBe(0);
    const moved = await runPlanner(withCal([appt('20:00', '21:00')]));
    expect(moved.ran).toBe(true);
    expect(moved.result!.load[TUE]!.planned).toBe(60);
    // A day without a window or a fixed block: the appointment's hour alone does not rerun (its minutes do).
    const calm = await runPlanner(withCal([appt('20:00', '21:00')], [todo('a', 30)]));
    const later = await runPlanner(withCal([appt('21:00', '22:00')], [todo('a', 30)]));
    expect(later.inputs.hash).toBe(calm.inputs.hash);
  });

  it('a habit block takes time off the day like an appointment and is never a row', async () => {
    const plain = await runPlanner(deps([todo('a', 30)]));
    const blocked = await runPlanner(deps([todo('a', 30)], [walk(TODAY, 60)]));
    expect(blocked.result!.load[TODAY]!.raw).toBe(plain.result!.load[TODAY]!.raw - 60);
    expect(blocked.result!.load[TODAY]!.free).toBe(plain.result!.load[TODAY]!.free - 48);
    // A block is never a row.
    expect(
      (await assignmentRepo.active().toArray()).some((a) => a.itemKey.startsWith('habits')),
    ).toBe(false);
  });
});

describe('the board', () => {
  it('shows the training with its time, counts it once beside an overlapping appointment, lists the block', async () => {
    await runPlanner(deps([training(), todo('a', 30)], [walk(TUE)]));
    const board = buildBoard({
      today: TODAY,
      span: 7,
      settings: H,
      dayRows: [],
      itemRows: [],
      assignments: await assignmentRepo.active().toArray(),
      entries: [training(), todo('a', 30)],
      calendar: [
        {
          id: 'e1',
          source: 'calendar',
          kind: 'event',
          title: 'Teamrunde',
          date: TUE,
          time: '18:30',
          endTime: '19:30',
          allDay: false,
          to: '/calendar',
        },
      ],
      blocks: [walk(TUE)],
      unplaced: [],
    });
    const tue = board.days.find((d) => d.date === TUE)!;
    const row = tue.rows.find((r) => r.itemKey === 'fitness:s1')!;
    expect(row.fixed).toEqual({ from: '18:00', to: '19:00' });
    expect(row.hardDue).toBeUndefined();
    expect(
      tue.blockers.map((b) => [b.label, b.min, b.module ?? (b.calendar ? 'cal' : 'own')]),
    ).toEqual([
      ['Teamrunde', 60, 'cal'],
      ['Spazieren gehen', 30, 'habits'],
    ]);
    // Only the half hour before the appointment counts for the training.
    expect(tue.planned).toBe(30);
  });
});

describe('sentences and „Rest verteilen“ leave a fixed training where it is', () => {
  const boardOf = async (entries: PlannableEntry[]) => {
    // The day is laid out once; the training needs nobody to lay it (its source fixes it).
    await runPlanner(deps(entries), { force: true, reshuffle: true });
    return buildBoard({
      today: TODAY,
      span: 7,
      settings: H,
      dayRows: [],
      itemRows: [],
      assignments: await assignmentRepo.active().toArray(),
      entries,
      calendar: [],
      unplaced: [],
    });
  };
  // The training is today at 18:00 (it is 10:00).
  const today18 = training({ earliest: TODAY });

  it('the rules see it as fixed; „Rest verteilen“ moves the ToDo but never the training', async () => {
    const board = await boardOf([today18, todo('a', 30)]);
    const items = instructionItems(board);
    expect(items.find((i) => i.key === 'fitness:s1')).toMatchObject({ date: TODAY, fixed: true });
    const ops = restToTomorrow({ today: TODAY, items });
    expect(ops).toContainEqual({ op: 'earliest', key: 'todos:a', date: TUE });
    expect(ops.some((o) => 'key' in o && o.key === 'fitness:s1')).toBe(false);
    expect(restIsEmpty(ops)).toBe(false);
  });

  it('only the training left today: no op for it, the calm „nothing“ line instead of a preview', async () => {
    const board = await boardOf([today18]);
    const ops = restToTomorrow({ today: TODAY, items: instructionItems(board) });
    expect(ops).toEqual([{ op: 'available', date: TODAY, min: 0 }]);
    expect(restIsEmpty(ops)).toBe(true);
  });
});
