/**
 * Parts of the day (use case „Wochenende retten“, F2): the order inside a day is tier → part (none, morning,
 * afternoon, evening) → today's keys; a part never changes the day; with a window a thing gets its time in its
 * third, or the next free place later. Deterministic, a fixpoint.
 */
import { describe, expect, it } from 'vitest';
import { plan } from './engine';
import { explainPart } from './explain';
import type { PlanDay, PlanDayPart, PlanInput, PlanItem, PlanResult } from './types';
import { partStart, placeInWindow } from './windows';

const SAT = '2026-11-14';
const days = (avail: number[], window?: { from: string; to: string }): PlanDay[] =>
  avail.map((availableMin, i) => ({
    date: `2026-11-${String(14 + i).padStart(2, '0')}`,
    availableMin,
    blockers: [],
    ...(window ? { window } : {}),
  }));
const item = (key: string, part?: PlanDayPart, over: Partial<PlanItem> = {}): PlanItem => ({
  key: `todos:${key}`,
  priority: 0,
  durationMin: 30,
  createdAt: key.charCodeAt(0),
  ...(part ? { part } : {}),
  ...over,
});
const settings = { horizonDays: 3, bufferShare: 0, mainPerDay: 10 };
const order = (r: PlanResult, date = SAT) =>
  r.assignments
    .filter((a) => a.date === date)
    .sort((a, b) => a.order - b.order)
    .map((a) => a.itemKey.slice(6));
const shape = (r: PlanResult) =>
  r.assignments
    .map((a) => [a.id, a.date, a.minutes, a.order, a.from ?? '', a.to ?? ''] as const)
    .sort();

const items = [
  item('a', 'evening'),
  item('b', 'afternoon'),
  item('c'),
  item('d', 'morning'),
  item('e', 'afternoon', { priority: 2 }),
];
const input: PlanInput = { today: SAT, days: days([600, 240, 240]), items, settings };

describe('parts of the day', () => {
  it('orders a day: without a part first, then morning, afternoon, evening – priority inside a part', () => {
    expect(order(plan(input))).toEqual(['c', 'd', 'e', 'b', 'a']);
  });

  it('a pinned thing and a deadline stay ahead of the parts (tier first)', () => {
    const r = plan({
      ...input,
      items: [
        ...items,
        item('p', 'evening', { pinned: SAT }),
        item('f', 'evening', { due: { date: SAT, hard: true } }),
      ],
    });
    expect(order(r).slice(0, 2)).toEqual(['p', 'f']);
  });

  it('a part never changes the day', () => {
    const tight: PlanInput = { ...input, days: days([90, 60, 240]) };
    const without = plan({ ...tight, items: tight.items.map(({ part: _p, ...i }) => i) });
    const withParts = plan(tight);
    const dayOf = (r: PlanResult) => Object.fromEntries(r.assignments.map((a) => [a.id, a.date]));
    expect(dayOf(withParts)).toEqual(dayOf(without));
  });

  it('is deterministic and a fixpoint', () => {
    const first = plan(input);
    expect(plan(input)).toEqual(first);
    const again = plan({ ...input, prev: first.assignments });
    expect(shape(again)).toEqual(shape(first));
    expect(again.diff.moved).toHaveLength(0);
  });

  it('with a window each thing gets its time in its third, in order', () => {
    const r = plan({ ...input, days: days([600, 240, 240], { from: '08:00', to: '20:00' }) });
    const at = Object.fromEntries(
      r.assignments.filter((a) => a.date === SAT).map((a) => [a.itemKey.slice(6), a.from]),
    );
    // Thirds of 08:00–20:00: 08:00, 12:00, 16:00.
    expect(at).toEqual({ c: '08:00', d: '08:45', e: '12:00', b: '12:45', a: '16:00' });
    const again = plan({
      ...input,
      days: days([600, 240, 240], { from: '08:00', to: '20:00' }),
      prev: r.assignments,
    });
    expect(shape(again)).toEqual(shape(r));
  });

  it('a thing that does not fit in its third takes the next free place later; none left: no time', () => {
    const w = { from: '09:00', to: '12:00' };
    expect(partStart(w, 'morning')).toBe(9 * 60);
    expect(partStart(w, 'afternoon')).toBe(10 * 60);
    expect(partStart(w, 'evening')).toBe(11 * 60);
    const out = placeInWindow(
      w,
      [{ from: '11:00', to: '11:45' }],
      [
        { id: 'x', minutes: 50, part: 'afternoon' },
        { id: 'y', minutes: 60, part: 'evening' },
      ],
    );
    expect(out.get('x')).toEqual({ from: '10:00', to: '10:50' });
    // The evening third (11:00–12:00) is blocked until 11:45: 60 min fit nowhere after it – no time.
    expect(out.has('y')).toBe(false);
  });

  it('a pinned evening thing never pushes a morning thing out of the morning', () => {
    const w = { from: '08:00', to: '20:00' };
    const r = plan({
      today: SAT,
      days: days([600, 240, 240], w),
      items: [item('p', 'evening', { pinned: SAT }), item('m', 'morning')],
      settings,
    });
    const at = Object.fromEntries(
      r.assignments.filter((a) => a.date === SAT).map((a) => [a.itemKey.slice(6), a.from]),
    );
    expect(order(r)).toEqual(['p', 'm']);
    expect(at).toEqual({ m: '08:00', p: '16:00' });
  });

  it('says the part in „Warum hier?“', () => {
    expect(explainPart('afternoon')).toBe('Nachmittag, wie gewählt');
  });
});
