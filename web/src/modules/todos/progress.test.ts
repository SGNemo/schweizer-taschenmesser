import { describe, expect, it } from 'vitest';
import {
  leftToday,
  seriesKey,
  streakOf,
  streaksOf,
  weekReview,
  type ProgressTask,
} from './progress';

const TODAY = '2026-10-02';
const at = (day: number, h = 12) => new Date(2026, 9, day, h).getTime();
let n = 0;
const task = (over: Partial<ProgressTask> = {}): ProgressTask => ({
  id: `t${++n}`,
  title: 'Aufgabe',
  done: false,
  createdAt: 1000 + n,
  ...over,
});
const daily = { freq: 'daily', interval: 1 } as const;

describe('series ("n in Folge")', () => {
  it('counts done instances in a row; the open one due today is not missed yet', () => {
    const inst = [
      { dueDate: '2026-09-28', done: true },
      { dueDate: '2026-09-29', done: true },
      { dueDate: '2026-09-30', done: true },
      { dueDate: '2026-10-02', done: false },
    ];
    expect(streakOf(inst, TODAY)).toEqual({ streak: 3, rest: 0 });
  });

  it('a missed (overdue) instance is bridged by a rest day, once', () => {
    const inst = [
      { dueDate: '2026-09-29', done: true },
      { dueDate: '2026-09-30', done: true },
      { dueDate: '2026-10-01', done: false },
    ];
    expect(streakOf(inst, TODAY)).toEqual({ streak: 2, rest: 1 });
    expect(streakOf(inst, TODAY, 0)).toEqual({ streak: 0, rest: 0 });
  });

  it('a second miss ends the run, and an empty run shows no pause either', () => {
    const inst = [
      { dueDate: '2026-09-28', done: true },
      { dueDate: '2026-09-29', done: false },
      { dueDate: '2026-09-30', done: false },
    ];
    expect(streakOf(inst, TODAY)).toEqual({ streak: 0, rest: 0 });
  });

  it('ignores instances in the future and instances without a date', () => {
    expect(
      streakOf(
        [
          { dueDate: '2026-10-05', done: true },
          { dueDate: undefined, done: true },
          { dueDate: '2026-10-01', done: true },
        ],
        TODAY,
      ),
    ).toEqual({ streak: 1, rest: 0 });
  });

  it('groups by series (first id) and only reports runs of two or more', () => {
    const tasks = [
      task({ id: 'a', title: 'Wäsche', recurrence: daily, dueDate: '2026-09-30', done: true }),
      task({
        id: 'a:2026-10-01',
        title: 'Wäsche',
        recurrence: daily,
        dueDate: '2026-10-01',
        done: true,
      }),
      task({ id: 'a:2026-10-02', title: 'Wäsche', recurrence: daily, dueDate: '2026-10-02' }),
      task({ id: 'b', title: 'Einzeln', recurrence: daily, dueDate: '2026-10-01', done: true }),
      task({ id: 'c', title: 'Keine Serie', dueDate: '2026-10-01', done: true }),
    ];
    const out = streaksOf(tasks, TODAY);
    expect([...out.keys()]).toEqual(['a']);
    expect(out.get('a')).toEqual({ streak: 2, rest: 0, title: 'Wäsche' });
    expect(seriesKey('a:2026-10-01')).toBe('a');
  });
});

describe('week review', () => {
  it('compares the last seven days with the seven before and finds the best day', () => {
    const tasks = [
      task({ done: true, completedAt: at(2) }),
      task({ done: true, completedAt: at(2, 15) }),
      task({ done: true, completedAt: at(1) }),
      task({ done: true, completedAt: new Date(2026, 8, 24).getTime() }), // previous week
      task({ done: true, completedAt: new Date(2026, 8, 23).getTime() }), // previous week
      task({ done: true, completedAt: at(2), parentId: 'x' }), // subtasks do not count
      task({ done: false }),
    ];
    const r = weekReview(tasks, TODAY);
    expect(r).toMatchObject({ doneThisWeek: 3, donePrevWeek: 2, tone: 'more' });
    expect(r.bestDay).toEqual({ date: '2026-10-02', count: 2 });
  });

  it('is never phrased as a shortfall: fewer is "less" (a calm week), nothing is "none"', () => {
    const prev = [20, 21, 22].map((d) =>
      task({ done: true, completedAt: new Date(2026, 8, d).getTime() }),
    );
    expect(weekReview([...prev, task({ done: true, completedAt: at(1) })], TODAY).tone).toBe(
      'less',
    );
    expect(weekReview(prev, TODAY).tone).toBe('none');
    expect(weekReview([], TODAY)).toEqual({ doneThisWeek: 0, donePrevWeek: 0, tone: 'none' });
  });

  it('same count is "same"; a best day needs at least two', () => {
    const r = weekReview(
      [
        task({ done: true, completedAt: at(1) }),
        task({ done: true, completedAt: new Date(2026, 8, 25).getTime() }),
      ],
      TODAY,
    );
    expect(r.tone).toBe('same');
    expect(r.bestDay).toBeUndefined();
  });
});

describe('leftToday', () => {
  it('open top-level tasks planned for today or earlier', () => {
    const tasks = [
      task({ id: 'a', plannedFor: TODAY }),
      task({ id: 'b', plannedFor: '2026-10-01' }),
      task({ id: 'c', plannedFor: '2026-10-03' }),
      task({ id: 'd', plannedFor: TODAY, done: true }),
      task({ id: 'e', plannedFor: TODAY, parentId: 'a' }),
      task({ id: 'f' }),
    ];
    expect(leftToday(tasks, TODAY).map((t) => t.id)).toEqual(['a', 'b']);
  });
});
