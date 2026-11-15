/**
 * Package 4b: day parts (Vormittag / Nachmittag / Abend). A part orders the units of a day (after the
 * tier, before priority) and, with a window, gives them a time inside the fixed borders 12:00 and 18:00.
 * It never changes a unit's day, and the engine stays deterministic and a fixpoint.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setLang } from '@/core/i18n/lang';
import { plan } from './engine';
import { explainAssignment } from './explain';
import type { DayPart, PlanDay, PlanInput, PlanItem, PlanResult } from './types';
import { partSpan, placeInWindow } from './windows';

afterEach(() => setLang('de'));

const MON = '2026-11-09';
const days = (window?: { from: string; to: string }, avail = 480): PlanDay[] =>
  Array.from({ length: 7 }, (_, i) => ({
    date: `2026-11-${String(9 + i).padStart(2, '0')}`,
    availableMin: i < 5 ? avail : 0,
    blockers: [],
    ...(window && i === 0 ? { window } : {}),
  }));
const item = (key: string, over: Partial<PlanItem> = {}): PlanItem => ({
  key: `todos:${key}`,
  priority: 1,
  durationMin: 30,
  createdAt: Number(key.charCodeAt(0)),
  ...over,
});
const H = { horizonDays: 7, bufferShare: 0, mainPerDay: 10 };
const run = (items: PlanItem[], d = days(), prev?: PlanInput['prev']): PlanResult =>
  plan({ today: MON, days: d, items, settings: H, ...(prev ? { prev } : {}) });
const dayOf = (r: PlanResult, date = MON) =>
  r.assignments
    .filter((a) => a.date === date)
    .sort((a, b) => a.order - b.order)
    .map((a) => a.itemKey.slice(6));
const times = (r: PlanResult) =>
  Object.fromEntries(
    r.assignments.filter((a) => a.from).map((a) => [a.itemKey.slice(6), [a.from, a.to]]),
  );
const shape = (r: PlanResult) =>
  r.assignments.map((a) => [a.id, a.date, a.minutes, a.order, a.from, a.to] as const).sort();

describe('order inside the day', () => {
  it('none first, then Vormittag, Nachmittag, Abend – before priority; the typed order stays inside a part', () => {
    const r = run([
      item('a', { part: 'evening', priority: 3 }),
      item('b'),
      item('c', { part: 'morning' }),
      item('d', { part: 'afternoon' }),
      item('e'),
      item('f', { part: 'evening' }),
    ]);
    expect(dayOf(r)).toEqual(['b', 'e', 'c', 'd', 'a', 'f']);
  });

  it('the tier still leads: a pinned or deadline unit with „Abend“ stays before the rest', () => {
    const r = run([
      item('a', { part: 'evening', pinned: MON }),
      item('b', { part: 'evening', due: { date: MON, hard: true } }),
      item('c'),
    ]);
    expect(dayOf(r)).toEqual(['a', 'b', 'c']);
  });

  it('a part never changes the day: the same days with and without parts', () => {
    const base = [
      item('a', { durationMin: 90 }),
      item('b', { durationMin: 90 }),
      item('c', { durationMin: 90, priority: 2 }),
      item('d', { durationMin: 60, earliest: '2026-11-10' }),
      item('e', { durationMin: 200, splittable: true }),
    ];
    const tight = days(undefined, 180);
    const parts: DayPart[] = ['evening', 'morning', 'afternoon', 'evening', 'morning'];
    const withParts = base.map((i, n) => ({ ...i, part: parts[n] }));
    const daysOf = (r: PlanResult) => r.assignments.map((a) => [a.id, a.date, a.minutes]).sort();
    expect(daysOf(run(withParts, tight))).toEqual(daysOf(run(base, tight)));
    expect(run(withParts, tight).unplaced).toEqual(run(base, tight).unplaced);
  });

  it('is deterministic and a fixpoint (with a window)', () => {
    const items = [
      item('a', { part: 'evening' }),
      item('b', { part: 'morning', durationMin: 120 }),
      item('c'),
      item('d', { part: 'afternoon' }),
    ];
    const d = days({ from: '09:00', to: '21:00' });
    const first = run(items, d);
    expect(shape(run(items, d))).toEqual(shape(first));
    const again = run(items, d, first.assignments);
    expect(shape(again)).toEqual(shape(first));
    expect(again.diff.moved).toEqual([]);
    expect(again.diff.added).toEqual([]);
  });
});

describe('times inside a window (fixed borders 12:00 and 18:00)', () => {
  it('cuts the parts to the window, never in thirds', () => {
    const w = { from: '08:00', to: '20:00' };
    expect(partSpan(w, 'morning')).toEqual([480, 720]);
    expect(partSpan(w, 'afternoon')).toEqual([720, 1080]);
    expect(partSpan(w, 'evening')).toEqual([1080, 1200]);
    // 08–16: the evening lies outside the window.
    expect(partSpan({ from: '08:00', to: '16:00' }, 'evening')).toBeUndefined();
    expect(partSpan({ from: '13:00', to: '22:00' }, 'morning')).toBeUndefined();
  });

  it('each unit gets its time in its part', () => {
    const r = run(
      [item('a', { part: 'evening' }), item('b', { part: 'afternoon' }), item('c')],
      days({ from: '09:00', to: '21:00' }),
    );
    expect(times(r)).toEqual({
      c: ['09:00', '09:30'],
      b: ['12:00', '12:30'],
      a: ['18:00', '18:30'],
    });
  });

  it('overflow over the border: a part without room takes the next free place later, else no time', () => {
    // Vormittag 09:00–12:00 holds 120 + pause; the second 90 min unit no longer fits before 12:00 and starts
    // in the afternoon stretch (the next free place later), the third finds nothing before 13:00 (window end).
    const r = run(
      [
        item('a', { part: 'morning', durationMin: 120 }),
        item('b', { part: 'morning', durationMin: 90 }),
        item('c', { part: 'morning', durationMin: 60 }),
      ],
      days({ from: '09:00', to: '13:00' }),
    );
    expect(dayOf(r)).toEqual(['a', 'b', 'c']);
    expect(times(r)).toEqual({ a: ['09:00', '11:00'], b: ['11:15', '12:45'] });
  });

  it('window 08–16 with „Abend“: only the order, the time follows the units before it', () => {
    const r = run(
      [item('a', { part: 'evening' }), item('b'), item('c', { part: 'morning' })],
      days({ from: '08:00', to: '16:00' }),
    );
    expect(dayOf(r)).toEqual(['b', 'c', 'a']);
    expect(times(r)).toEqual({
      b: ['08:00', '08:30'],
      c: ['08:45', '09:15'],
      a: ['09:30', '10:00'],
    });
  });

  it('a full morning of things without a part pushes „Vormittag“ past 12:00 (none first, then the next free place)', () => {
    const r = run(
      [
        item('a', { part: 'morning' }),
        item('b', { durationMin: 120 }),
        item('c', { durationMin: 60 }),
      ],
      days({ from: '09:00', to: '18:00' }),
    );
    expect(dayOf(r)).toEqual(['b', 'c', 'a']);
    expect(times(r)).toEqual({
      b: ['09:00', '11:00'],
      c: ['11:15', '12:15'],
      a: ['12:30', '13:00'],
    });
  });

  it('a pinned „Abend“ is stepped around: the rest still starts in the morning', () => {
    const r = run(
      [item('a', { part: 'evening', pinned: MON }), item('b'), item('c', { part: 'morning' })],
      days({ from: '09:00', to: '21:00' }),
    );
    expect(dayOf(r)).toEqual(['a', 'b', 'c']);
    expect(times(r)).toEqual({
      a: ['18:00', '18:30'],
      b: ['09:00', '09:30'],
      c: ['09:45', '10:15'],
    });
  });

  it('without parts the walk is the plain cursor of package 5', () => {
    const sessions = [
      { id: 'x', minutes: 60 },
      { id: 'y', minutes: 200 },
      { id: 'z', minutes: 30 },
    ];
    const out = placeInWindow({ from: '09:00', to: '13:00' }, [], sessions);
    expect(Object.fromEntries(out)).toEqual({
      x: { from: '09:00', to: '10:00' },
      z: { from: '10:15', to: '10:45' },
    });
  });
});

describe('explain', () => {
  const nameOf = (id: string) => id;
  it('adds the chosen part in German and English', async () => {
    expect(explainAssignment({ reason: 'new' }, { part: 'evening', nameOf })).toBe(
      'neu, nach Priorität · abends, wie gewählt',
    );
    expect(explainAssignment({ reason: 'new' }, { nameOf })).toBe('neu, nach Priorität');
    await loadCatalog('en');
    setLang('en');
    expect(explainAssignment({ reason: 'kept' }, { part: 'afternoon', nameOf })).toBe(
      'as planned · in the afternoon, as you chose',
    );
  });
});
