import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { plan } from './engine';
import type { PlanDay, PlanItem, PrevAssignment } from './types';

/**
 * The plan stays put (docs/design/planner-rethink/CONCEPT.md §2): with `loose` the engine only proposes days
 * for the items handed to it. Everything else keeps its day whatever the room, a passed day is left alone
 * and a thing without a day gets none.
 */
const MON = '2026-11-16';
const days = (n = 7, availableMin = 240): PlanDay[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(MON, i), availableMin, blockers: [] }));
const item = (key: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  key,
  durationMin: 60,
  priority: 0,
  createdAt: 1,
  ...extra,
});
const on = (key: string, date: string): PrevAssignment => ({ id: `${key}#0`, date, reason: 'new' });
const settings = { horizonDays: 7 };
const where = (r: ReturnType<typeof plan>) =>
  Object.fromEntries(r.assignments.map((a) => [a.itemKey, a.date]));

describe('the plan stays put (`loose`)', () => {
  it('keeps every laid thing on its day, also when the day holds more than its time', () => {
    // 3 h 12 usable; five hours laid on Monday by hand.
    const items = ['a', 'b', 'c', 'd', 'e'].map((k) => item(k));
    const r = plan({
      today: MON,
      days: days(),
      items,
      prev: items.map((i) => on(i.key, MON)),
      loose: [],
      settings,
    });
    expect(where(r)).toEqual({ a: MON, b: MON, c: MON, d: MON, e: MON });
    expect(r.load[MON]!.over).toBe(300 - 192);
    expect(r.diff.moved).toEqual([]);
    expect(r.diff.removed).toEqual([]);
  });

  it('a higher priority, a hard deadline or a pin of another thing moves nothing', () => {
    const items = [
      item('a'),
      item('b'),
      item('c'),
      item('urgent', { priority: 3, due: { date: MON, hard: true } }),
    ];
    const prev = [on('a', MON), on('b', MON), on('c', MON), on('urgent', addDays(MON, 3))];
    const r = plan({ today: MON, days: days(), items, prev, loose: [], settings });
    expect(where(r)).toEqual({ a: MON, b: MON, c: MON, urgent: addDays(MON, 3) });
  });

  it('leaves a passed day alone: not placed anew, not removed, not in the diff', () => {
    const items = [item('missed'), item('today')];
    const prev = [on('missed', addDays(MON, -2)), on('today', MON)];
    const r = plan({ today: MON, days: days(), items, prev, loose: [], settings });
    expect(where(r)).toEqual({ today: MON });
    expect(r.kept).toEqual(['missed#0']);
    expect(r.unplaced).toEqual([]);
    expect(r.diff).toEqual({ added: [], moved: [], removed: [], unchanged: 1 });
  });

  it('leaves a day beyond the planned days alone', () => {
    const far = addDays(MON, 21);
    const r = plan({
      today: MON,
      days: days(),
      items: [item('far')],
      prev: [on('far', far)],
      loose: [],
      settings,
    });
    expect(r.assignments).toEqual([]);
    expect(r.kept).toEqual(['far#0']);
  });

  it('gives a thing without a day none unless it is handed over', () => {
    const r = plan({
      today: MON,
      days: days(),
      items: [item('new')],
      prev: [],
      loose: [],
      settings,
    });
    expect(r.assignments).toEqual([]);
    expect(r.unplaced.map((u) => [u.id, u.reason])).toEqual([['new#0', 'no-day']]);
    const asked = plan({
      today: MON,
      days: days(),
      items: [item('new')],
      prev: [],
      loose: ['new'],
      settings,
    });
    expect(where(asked)).toEqual({ new: MON });
  });

  it('places a handed-over thing only into room that is left; what lies is not displaced', () => {
    // Monday holds three hours (12 minutes left): the loose hour goes to Tuesday.
    const laid = ['a', 'b', 'c'].map((k) => item(k));
    const r = plan({
      today: MON,
      days: days(),
      items: [...laid, item('loose', { priority: 3 })],
      prev: laid.map((i) => on(i.key, MON)),
      loose: ['loose'],
      settings,
    });
    expect(where(r)).toEqual({ a: MON, b: MON, c: MON, loose: addDays(MON, 1) });
  });

  it('moves a handed-over thing that has a day and names it in the diff', () => {
    // „Rest verteilen“: today's thing, not before tomorrow.
    const r = plan({
      today: MON,
      days: days(),
      items: [item('rest', { earliest: addDays(MON, 1) }), item('stays')],
      prev: [on('rest', MON), on('stays', MON)],
      loose: ['rest'],
      settings,
    });
    expect(where(r)).toEqual({ rest: addDays(MON, 1), stays: MON });
    expect(r.diff.moved.map((m) => [m.id, m.from, m.to])).toEqual([
      ['rest#0', MON, addDays(MON, 1)],
    ]);
  });

  it('a handed-over thing the rules find no room for keeps the day it had – one thing, one place', () => {
    // A full week: every day holds three hours (12 minutes left). „rest“ lies on Monday and is handed over
    // with „not before tomorrow“ – no other day has room for its hour.
    const laid = Array.from({ length: 7 }, (_, d) =>
      ['x', 'y', 'z'].map((k) => [item(`${k}${d}`), addDays(MON, d)] as const),
    ).flat();
    const r = plan({
      today: MON,
      days: days(),
      items: [...laid.map(([i]) => i), item('rest', { earliest: addDays(MON, 1) })],
      prev: [...laid.map(([i, date]) => on(i.key, date)), on('rest', MON)],
      loose: ['rest'],
      settings,
    });
    expect(where(r).rest).toBe(MON);
    expect(r.unplaced).toEqual([]);
    expect(r.diff.moved).toEqual([]);
  });

  it('also a thing with a hard deadline that finds no room before it keeps its day', () => {
    const laid = Array.from({ length: 7 }, (_, d) =>
      ['x', 'y', 'z'].map((k) => [item(`${k}${d}`), addDays(MON, d)] as const),
    ).flat();
    const r = plan({
      today: MON,
      days: days(),
      items: [
        ...laid.map(([i]) => i),
        item('due', { durationMin: 240, due: { date: addDays(MON, 2), hard: true } }),
      ],
      prev: [...laid.map(([i, date]) => on(i.key, date)), on('due', addDays(MON, 4))],
      loose: ['due'],
      settings,
    });
    expect(where(r).due).toBe(addDays(MON, 4));
    expect(r.unplaced.filter((u) => u.date === undefined)).toEqual([]);
  });

  it('is deterministic and stable when a proposal is taken in part', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => item(k, { createdAt: i }));
    const all = plan({
      today: MON,
      days: days(),
      items,
      prev: [],
      loose: items.map((i) => i.key),
      settings,
    });
    expect(
      plan({ today: MON, days: days(), items, prev: [], loose: items.map((i) => i.key), settings }),
    ).toEqual(all);
    // Take the proposals for a, b, c; the rest is proposed again on the same days.
    const taken = all.assignments.filter((a) => ['a', 'b', 'c'].includes(a.itemKey));
    const again = plan({
      today: MON,
      days: days(),
      items,
      prev: taken.map((a) => ({ id: a.id, date: a.date, reason: a.reason })),
      loose: ['d', 'e', 'f'],
      settings,
    });
    expect(where(again)).toEqual(where(all));
  });
});
