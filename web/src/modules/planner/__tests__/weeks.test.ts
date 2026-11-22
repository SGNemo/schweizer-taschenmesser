/**
 * Planner rethink, package 4: the board reads 28 days and the 4-week grid builds its own stretch from a passed
 * Monday out of the same reads. Pinned: a passed day keeps its rows (it says „offen“), and both builds with
 * 200 placements stay fast.
 */
import { describe, expect, it } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { addDays } from '@/core/plan/dates';
import { buildBoard, type BoardInput } from '../board';
import type { AssignmentRow } from '../schema';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const TODAY = '2026-11-19'; // Thursday
const MONDAY = '2026-11-16';

const entries: PlannableEntry[] = Array.from({ length: 200 }, (_, i) => ({
  moduleId: 'todos',
  id: `t${i}`,
  kind: 'task',
  title: `Ding ${i}`,
  to: `/todos?open=t${i}`,
  durationMin: 15,
  createdAt: i,
}));
const assignments: (AssignmentRow & { id: string })[] = entries.map((e, i) => ({
  id: `todos:${e.id}#0`,
  itemKey: `todos:${e.id}`,
  k: 0,
  of: 1,
  // Spread over the grid's 28 days from Monday; the first three are passed.
  date: addDays(MONDAY, i % 28),
  minutes: 15,
  order: i,
  reason: 'new',
}));

const input = (over: Partial<BoardInput> = {}): BoardInput => ({
  today: TODAY,
  span: 28,
  settings: DEFAULT_PLANNER_SETTINGS,
  dayRows: [],
  itemRows: [],
  assignments,
  entries,
  calendar: [],
  unplaced: [],
  ...over,
});

describe('planner: more than a week (package 4)', () => {
  it('the grid from a passed Monday keeps the passed days with their rows', () => {
    const days = buildBoard(input({ from: MONDAY })).days;
    expect(days).toHaveLength(28);
    expect(days[0]!.date).toBe(MONDAY);
    expect(days[0]!.rows.length).toBeGreaterThan(0);
    // The board itself starts today.
    expect(buildBoard(input()).days[0]!.date).toBe(TODAY);
  });

  it('28 days with 200 placements: board and grid build fast', () => {
    const runs: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t = performance.now();
      buildBoard(input());
      buildBoard(input({ from: MONDAY }));
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    const median = runs[Math.floor(runs.length / 2)]!;
    // Only a coarse bound against a blow-up (measured locally: about 4 ms); slow CI machines stay far below it.
    expect(median).toBeLessThan(1000);
  });
});
