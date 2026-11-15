/**
 * Planner hub S4: fixed blocks (`PlanItem.fixed`, a training at 18:00) and module blocks (`PlanDay.blockers` from
 * `PlannableSource.blocks`, a habit's „Zeit im Plan freihalten“). A fixed block sits on its day at its time, takes
 * that time, is never moved and never late; a block takes time like an appointment.
 */
import { describe, expect, it } from 'vitest';
import { capacity, fixedCharges, fixedSpan } from './capacity';
import { plan } from './engine';
import type { PlanDay, PlanInput, PlanItem, PlanResult } from './types';

const MON = '2026-11-09';
const TUE = '2026-11-10';
const week = (avail = [240, 240, 240, 240, 240, 120, 0]): PlanDay[] =>
  avail.map((availableMin, i) => ({
    date: `2026-11-${String(9 + i).padStart(2, '0')}`,
    availableMin,
    blockers: [],
  }));
const item = (key: string, over: Partial<PlanItem> = {}): PlanItem => ({
  key: `todos:${key}`,
  priority: 1,
  createdAt: 1,
  ...over,
});
const gym = (date: string, from = '18:00', durationMin = 60): PlanItem => ({
  key: 'fitness:s1',
  priority: 0,
  durationMin,
  createdAt: 5,
  fixed: { date, from },
});
const H = { horizonDays: 7 };
const shape = (r: PlanResult) =>
  r.assignments.map((a) => [a.id, a.date, a.minutes, a.order, a.from, a.to] as const).sort();
const rerun = (input: PlanInput): PlanResult => {
  const first = plan(input);
  return plan({ ...input, prev: first.assignments });
};

describe('fixedSpan and fixedCharges', () => {
  it('a missing end is the start plus the minutes, never past the end of the day', () => {
    expect(fixedSpan({ from: '18:00' }, 60)).toEqual({ from: '18:00', to: '19:00' });
    expect(fixedSpan({ from: '18:00', to: '18:30' }, 60)).toEqual({ from: '18:00', to: '18:30' });
    expect(fixedSpan({ from: '23:30' }, 90)).toEqual({ from: '23:30', to: '23:59' });
    expect(fixedSpan({ from: 'abends' }, 60)).toBeUndefined();
  });

  it('what a timed blocker or an earlier block covers is not taken twice', () => {
    const blockers = [{ from: '18:30', to: '19:30' }, {}];
    expect(
      fixedCharges(
        [
          { minutes: 60, from: '18:00', to: '19:00' },
          { minutes: 60, from: '18:00', to: '19:00' },
          { minutes: 30 },
        ],
        blockers,
      ),
    ).toEqual([30, 0, 30]);
  });
});

describe('a fixed block (S4)', () => {
  it('sits on its own day at its own time, first in the day, and takes its minutes', () => {
    const r = plan({
      today: MON,
      days: week(),
      items: [item('a', { durationMin: 60 }), gym(TUE)],
      settings: H,
    });
    const a = r.assignments.find((x) => x.itemKey === 'fitness:s1')!;
    expect(a).toMatchObject({ date: TUE, order: 0, from: '18:00', to: '19:00', minutes: 60 });
    expect(r.load[TUE]!.planned).toBe(60);
    expect(r.load[TUE]!.mains).toBe(0);
    expect(r.unplaced).toEqual([]);
  });

  it('on an overbooked day it stays put, the overrun is counted and the others move on', () => {
    const days = week([60, 240, 240, 240, 240, 120, 0]);
    const r = plan({
      today: MON,
      days,
      items: [
        gym(MON, '17:00', 90),
        item('pin', { durationMin: 30, pinned: MON }),
        item('b', { durationMin: 30, priority: 3 }),
      ],
      settings: H,
    });
    const on = (key: string) => r.assignments.find((x) => x.itemKey === key);
    expect(on('fitness:s1')).toMatchObject({ date: MON, order: 0, from: '17:00', to: '18:30' });
    expect(on('todos:pin')?.date).toBe(MON);
    expect(on('todos:b')?.date).toBe(TUE);
    // usable 48 of 60; 90 + 30 planned.
    expect(r.load[MON]).toMatchObject({ planned: 120, over: 72, free: 0 });
    expect(r.unplaced).toEqual([]);
    expect(shape(rerun({ today: MON, days, items: [gym(MON, '17:00', 90)], settings: H }))).toEqual(
      shape(plan({ today: MON, days, items: [gym(MON, '17:00', 90)], settings: H })),
    );
  });

  it('no rule moves it: not a pin elsewhere, not a hard due, not a previous plan', () => {
    const fixed = { ...gym(TUE), pinned: '2026-11-12', due: { date: MON, hard: true } };
    const r = plan({
      today: MON,
      days: week(),
      items: [fixed],
      prev: [{ id: 'fitness:s1#0', date: '2026-11-11', reason: 'new' }],
      settings: H,
    });
    expect(r.assignments.map((a) => [a.id, a.date])).toEqual([['fitness:s1#0', TUE]]);
    // Never late, never waiting, though its hard due was Monday.
    expect(r.assignments[0]!.late).toBeUndefined();
    expect(r.unplaced).toEqual([]);
    expect(r.diff.moved).toEqual([
      { id: 'fitness:s1#0', from: '2026-11-11', to: TUE, reason: 'pinned' },
    ]);
  });

  it('is never split, also when it is longer than a session', () => {
    const r = plan({ today: MON, days: week(), items: [gym(MON, '08:00', 180)], settings: H });
    expect(shape(r)).toEqual([['fitness:s1#0', MON, 180, 0, '08:00', '11:00']]);
  });

  it('outside the horizon it is neither placed nor reported, and asks for no time', () => {
    for (const date of ['2026-11-08', '2026-11-20']) {
      const r = plan({ today: MON, days: week(), items: [gym(date)], settings: H });
      expect(r.assignments).toEqual([]);
      expect(r.unplaced).toEqual([]);
      expect(r.demandMin).toBe(0);
    }
  });

  it('an appointment that overlaps it is not counted twice', () => {
    const days = week();
    days[0]!.blockers = [{ label: 'Teamrunde', min: 60, from: '18:30', to: '19:30' }];
    const r = plan({ today: MON, days, items: [gym(MON)], settings: H });
    // raw 240 − 60 = 180; the training adds only its first half hour.
    expect(r.load[MON]).toMatchObject({ raw: 180, planned: 30 });
    expect(r.assignments[0]).toMatchObject({ minutes: 60, from: '18:00', to: '19:00' });
  });

  it('a session of the day steps around it inside the window, as around an appointment', () => {
    const days = week();
    days[0]!.window = { from: '17:00', to: '21:00' };
    const r = plan({
      today: MON,
      days,
      items: [gym(MON, '17:00', 60), item('a', { durationMin: 30 })],
      settings: H,
    });
    expect(r.assignments.find((a) => a.itemKey === 'todos:a')).toMatchObject({
      from: '18:00',
      to: '18:30',
      order: 1,
    });
  });

  it('done or „Nicht planen“ takes it out; the rerun on the same input is a fixpoint', () => {
    const input: PlanInput = {
      today: MON,
      days: week(),
      items: [gym(MON), item('a', { durationMin: 45 }), gym(TUE, '07:00')].map((x, i) =>
        i === 2 ? { ...x, key: 'fitness:s2' } : x,
      ),
      settings: H,
    };
    expect(shape(rerun(input))).toEqual(shape(plan(input)));
    expect(plan(input)).toEqual(plan(input));
    const done = plan({ ...input, items: input.items.map((x) => ({ ...x, done: true })) });
    expect(done.assignments).toEqual([]);
    const out = plan({ ...input, items: [{ ...gym(MON), excluded: true }] });
    expect(out.assignments).toEqual([]);
  });
});

describe('module blocks (S4: a habit keeps time free)', () => {
  it('a block takes time like an appointment and is no row', () => {
    const days = week();
    days[0]!.blockers = [{ id: 'habits:walk:2026-11-09', label: 'Spazieren gehen', min: 30 }];
    const r = plan({ today: MON, days, items: [item('a', { durationMin: 30 })], settings: H });
    expect(r.load[MON]).toMatchObject({ raw: 210, usable: 168 });
    expect(r.assignments.map((a) => a.itemKey)).toEqual(['todos:a']);
  });

  it('a block on a day without time leaves the day at zero, never below', () => {
    const days = week([0, 240, 240, 240, 240, 120, 0]);
    days[0]!.blockers = [{ label: 'Spazieren gehen', min: 30 }];
    expect(capacity(days[0]!, { bufferShare: 0.2 })).toEqual({ raw: 0, usable: 0, blocked: 30 });
    const r = plan({ today: MON, days, items: [item('a', { durationMin: 30 })], settings: H });
    expect(r.load[MON]).toMatchObject({ raw: 0, usable: 0, planned: 0, over: 0 });
    expect(r.assignments[0]?.date).toBe(TUE);
  });

  it('a block next to an overlapping appointment: each counts once, a fixed block over both adds nothing', () => {
    const days = week();
    days[0]!.blockers = [
      { label: 'Zahnarzt', min: 60, from: '14:00', to: '15:00' },
      { label: 'Spazieren gehen', min: 30 },
    ];
    const r = plan({ today: MON, days, items: [gym(MON, '14:00', 60)], settings: H });
    expect(r.load[MON]).toMatchObject({ raw: 150, planned: 0 });
  });
});
