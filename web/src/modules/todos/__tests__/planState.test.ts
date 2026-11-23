import { describe, expect, it } from 'vitest';
import { assignPatch } from '../plannable';
import { restorePatch } from '../planMark';
import {
  dayWordOf,
  passesPlanFilter,
  planStateOf,
  plannerPath,
  type PlanState,
} from '../planState';

const DAY = '2026-11-18'; // Wednesday
const open = { done: false };

describe('planStateOf', () => {
  it('reads the plan from the ToDo’s own fields', () => {
    expect(planStateOf({ ...open }, DAY)).toEqual({ kind: 'unplanned' });
    expect(
      planStateOf(
        { ...open, plannedFor: '2026-11-20', planMark: { date: '2026-11-20', order: 0 } },
        DAY,
      ),
    ).toEqual({ kind: 'planned', date: '2026-11-20', locked: false });
    expect(
      planStateOf({ ...open, plannedFor: DAY, planMark: { date: DAY, order: 2 } }, DAY, {
        locked: true,
      }),
    ).toEqual({ kind: 'planned', date: DAY, locked: true });
    // A passed day of the plan: the planner's „Noch offen“ – in the plan, said with „war Mo“.
    expect(
      planStateOf(
        { ...open, plannedFor: '2026-11-16', planMark: { date: '2026-11-16', order: 0 } },
        DAY,
      ),
    ).toEqual({ kind: 'passed', date: '2026-11-16', locked: false });
  });

  it('a date the person set (no mark, or a mark for another day) is no day in the plan', () => {
    expect(planStateOf({ ...open, plannedFor: '2026-11-20' }, DAY)).toEqual({ kind: 'unplanned' });
    // Field LWW from two devices: date of one, mark of the other → the safe direction.
    expect(
      planStateOf(
        { ...open, plannedFor: '2026-11-20', planMark: { date: '2026-11-21', order: 0 } },
        DAY,
      ),
    ).toEqual({ kind: 'unplanned' });
  });

  it('done, „Irgendwann“ and subtasks carry no mark; „Nicht planen“ wins over a day', () => {
    const planned = { plannedFor: DAY, planMark: { date: DAY, order: 0 } };
    expect(planStateOf({ done: true, ...planned }, DAY).kind).toBe('none');
    expect(planStateOf({ ...open, someday: true }, DAY).kind).toBe('none');
    expect(planStateOf({ ...open, parentId: 'p', ...planned }, DAY).kind).toBe('none');
    expect(planStateOf({ ...open }, DAY, { excluded: true }).kind).toBe('excluded');
  });

  it('follows the planner’s write-backs: laid, taken off, switched off', () => {
    const laid = { ...open, ...assignPatch({}, '2026-11-20', 0, DAY) };
    expect(planStateOf(laid, DAY).kind).toBe('planned');
    const off = { ...laid, ...assignPatch(laid, undefined, undefined, DAY) };
    expect(planStateOf(off, DAY).kind).toBe('unplanned');
    // Planner switched off and on again: the date stays the person's, no mark.
    const released = { ...laid, ...restorePatch(laid) };
    expect(planStateOf(released, DAY).kind).toBe('unplanned');
  });
});

describe('the filter', () => {
  const s = (kind: PlanState['kind']): PlanState =>
    kind === 'planned' || kind === 'passed'
      ? { kind, date: DAY, locked: false }
      : ({ kind } as PlanState);
  it('„Noch nicht im Plan“ is exactly unplanned; „Im Plan“ includes a passed day', () => {
    expect(
      ['unplanned', 'planned', 'passed', 'excluded', 'none'].map((k) =>
        passesPlanFilter(s(k as never), 'unplanned'),
      ),
    ).toEqual([true, false, false, false, false]);
    expect(
      ['unplanned', 'planned', 'passed', 'excluded', 'none'].map((k) =>
        passesPlanFilter(s(k as never), 'planned'),
      ),
    ).toEqual([false, true, true, false, false]);
    expect(passesPlanFilter(s('none'), 'all')).toBe(true);
  });
});

describe('day words and the jump', () => {
  it('today, a weekday in the coming week, else with the date', () => {
    expect(dayWordOf(DAY, DAY).kind).toBe('today');
    expect(dayWordOf('2026-11-24', DAY).kind).toBe('weekday');
    expect(dayWordOf('2026-11-25', DAY).kind).toBe('dated');
    expect(dayWordOf('2026-11-16', DAY).kind).toBe('weekday');
  });
  it('a day leads to the planner on that day with the row, a passed one to „Noch offen“', () => {
    expect(plannerPath({ kind: 'planned', date: DAY, locked: false }, 't1')).toBe(
      `/planner?day=${DAY}&item=todos%3At1`,
    );
    expect(plannerPath({ kind: 'passed', date: '2026-11-16', locked: false }, 't1')).toBe(
      '/planner?tab=open&item=todos%3At1',
    );
    expect(plannerPath({ kind: 'unplanned' }, 't1')).toBeUndefined();
  });
});
