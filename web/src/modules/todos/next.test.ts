import { describe, expect, it } from 'vitest';
import { dayPlan, nextTier, pickNext, replan, waitingTasks, type PickTask } from './next';

const TODAY = '2026-10-02';
let n = 0;
const task = (over: Partial<PickTask> & { title?: string } = {}): PickTask => ({
  id: over.id ?? `t${++n}`,
  done: false,
  priority: 0,
  order: 0,
  createdAt: 1000 + n,
  ...over,
});

describe('pickNext (nächste eine Sache)', () => {
  it('prefers what the user planned for today over any due date', () => {
    const a = task({ id: 'due', dueDate: TODAY, priority: 3 });
    const b = task({ id: 'plan', plannedFor: TODAY });
    expect(pickNext([a, b], TODAY)?.id).toBe('plan');
  });

  it('puts due today and soon before an old overdue date', () => {
    const old = task({ id: 'old', dueDate: '2026-09-01', priority: 3 });
    const soon = task({ id: 'soon', dueDate: '2026-10-04' });
    const today = task({ id: 'today', dueDate: TODAY });
    expect(pickNext([old, soon, today], TODAY)?.id).toBe('today');
    expect(pickNext([old, soon], TODAY)?.id).toBe('soon');
    expect(pickNext([old], TODAY)?.id).toBe('old');
  });

  it('inside a tier: higher priority, then the shorter estimate', () => {
    const quick = task({ id: 'quick', dueDate: TODAY, estimateMin: 5 });
    const long = task({ id: 'long', dueDate: TODAY, estimateMin: 60 });
    const high = task({ id: 'high', dueDate: TODAY, priority: 3, estimateMin: 60 });
    expect(pickNext([long, quick], TODAY)?.id).toBe('quick');
    expect(pickNext([long, quick, high], TODAY)?.id).toBe('high');
  });

  it('skips done, someday, subtasks and skipped ids; nothing left = undefined', () => {
    const tasks = [
      task({ id: 'done', done: true, dueDate: TODAY }),
      task({ id: 'some', someday: true }),
      task({ id: 'sub', parentId: 'x', dueDate: TODAY }),
      task({ id: 'skipped', dueDate: TODAY }),
    ];
    expect(pickNext(tasks, TODAY, ['skipped'])).toBeUndefined();
    expect(pickNext([], TODAY)).toBeUndefined();
  });

  it('tiers: planned 0, today 1, soon 2, overdue 3, rest 4', () => {
    expect(nextTier(task({ plannedFor: '2026-10-01' }), TODAY)).toBe(0);
    expect(nextTier(task({ dueDate: TODAY }), TODAY)).toBe(1);
    expect(nextTier(task({ dueDate: '2026-10-05' }), TODAY)).toBe(2);
    expect(nextTier(task({ dueDate: '2026-10-06' }), TODAY)).toBe(4);
    expect(nextTier(task({ dueDate: '2026-09-30' }), TODAY)).toBe(3);
    expect(nextTier(task({}), TODAY)).toBe(4);
  });
});

describe('dayPlan', () => {
  it('lists open tasks planned for today up to the limit and counts what is done today', () => {
    const noon = new Date(2026, 9, 2, 12, 0).getTime();
    const yesterday = new Date(2026, 9, 1, 12, 0).getTime();
    const tasks = [
      task({ id: 'a', plannedFor: TODAY, order: 2 }),
      task({ id: 'b', plannedFor: TODAY, order: 1 }),
      task({ id: 'c', plannedFor: TODAY, order: 3 }),
      task({ id: 'd', plannedFor: TODAY, order: 4 }),
      task({ id: 'later', plannedFor: '2026-10-03' }),
      task({ id: 'x', done: true, completedAt: noon }),
      task({ id: 'y', done: true, completedAt: yesterday }),
      task({ id: 'sub', done: true, completedAt: noon, parentId: 'a' }),
    ];
    const plan = dayPlan(tasks, TODAY, 3);
    expect(plan.planned.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(plan.hidden).toBe(1);
    expect(plan.doneToday).toBe(1);
    expect(plan.free).toBe(0);
    expect(dayPlan([], TODAY, 3).free).toBe(3);
  });
});

describe('waiting tasks and replan', () => {
  it('waiting = overdue open top-level tasks that are not planned ahead', () => {
    const tasks = [
      task({ id: 'o', dueDate: '2026-09-20' }),
      task({ id: 'p', dueDate: '2026-09-20', plannedFor: TODAY }),
      task({ id: 'ok', dueDate: TODAY }),
      task({ id: 'done', dueDate: '2026-09-20', done: true }),
    ];
    expect(waitingTasks(tasks, TODAY).map((t) => t.id)).toEqual(['o']);
  });

  it('spreads waiting tasks over the next days, perDay at most, counting existing load', () => {
    const waiting = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      task({ id, dueDate: `2026-09-${10 + i}`, priority: id === 'e' ? 3 : 0 }),
    );
    const busy = task({ id: 'busy', dueDate: TODAY });
    const out = replan([...waiting, busy], TODAY, 2);
    expect(out).toEqual([
      { id: 'e', dueDate: TODAY }, // highest priority first; today already has one task
      { id: 'a', dueDate: '2026-10-03' },
      { id: 'b', dueDate: '2026-10-03' },
      { id: 'c', dueDate: '2026-10-04' },
      { id: 'd', dueDate: '2026-10-04' },
    ]);
  });

  it('does nothing when nothing waits', () => {
    expect(replan([task({ dueDate: TODAY })], TODAY)).toEqual([]);
  });
});
