import { describe, expect, it } from 'vitest';
import { inWindow, matches } from './conditions';
import type { AutomationEvent, Condition } from './types';

const ev = (
  data: Record<string, unknown>,
  at = new Date(2026, 10, 1, 18, 0).getTime(),
): AutomationEvent => ({
  type: 'x',
  key: 'k',
  at,
  data,
});

describe('conditions', () => {
  it('compares numbers, text and dates', () => {
    const run = (cond: Condition, data: Record<string, unknown>) => matches([cond], ev(data));
    expect(run({ field: 'daysLeft', op: 'lte', value: 3 }, { daysLeft: 2 })).toBe(true);
    expect(run({ field: 'daysLeft', op: 'lte', value: 3 }, { daysLeft: '4' })).toBe(false);
    expect(run({ field: 'due', op: 'gte', value: '2026-11-01' }, { due: '2026-11-02' })).toBe(true);
    expect(run({ field: 'due', op: 'lt', value: '2026-11-01' }, { due: '2026-11-02' })).toBe(false);
    expect(run({ field: 'cat', op: 'eq', value: 'Miete' }, { cat: 'Miete' })).toBe(true);
    expect(run({ field: 'cat', op: 'neq', value: 'Miete' }, { cat: 'Miete' })).toBe(false);
    expect(run({ field: 'cat', op: 'in', value: ['a', 'b'] }, { cat: 'b' })).toBe(true);
  });

  it('contains works on text (case-insensitive) and lists, and reads nested fields', () => {
    const run = (cond: Condition, data: Record<string, unknown>) => matches([cond], ev(data));
    expect(
      run({ field: 'subject', op: 'contains', value: 'rechnung' }, { subject: 'Ihre Rechnung 42' }),
    ).toBe(true);
    expect(run({ field: 'tags', op: 'contains', value: 'work' }, { tags: ['home', 'work'] })).toBe(
      true,
    );
    expect(run({ field: 'a.b', op: 'eq', value: 1 }, { a: { b: 1 } })).toBe(true);
    expect(run({ field: 'missing', op: 'eq', value: 1 }, {})).toBe(false);
  });

  it('all conditions must hold; none means always', () => {
    const e = ev({ n: 5 });
    expect(matches([], e)).toBe(true);
    expect(
      matches(
        [
          { field: 'n', op: 'gt', value: 1 },
          { field: 'n', op: 'lt', value: 4 },
        ],
        e,
      ),
    ).toBe(false);
  });

  it('time windows, also across midnight and with weekdays', () => {
    const at = (h: number, m = 0, day = 1) => new Date(2026, 10, day, h, m).getTime(); // 1 Nov 2026 = Sunday
    expect(inWindow({ from: '09:00', to: '17:00' }, at(10))).toBe(true);
    expect(inWindow({ from: '09:00', to: '17:00' }, at(17))).toBe(false);
    expect(inWindow({ from: '22:00', to: '06:00' }, at(23))).toBe(true);
    expect(inWindow({ from: '22:00', to: '06:00' }, at(5, 30, 2))).toBe(true);
    expect(inWindow({ from: '22:00', to: '06:00' }, at(12))).toBe(false);
    expect(inWindow({ from: '09:00', to: '17:00', weekdays: [1, 2] }, at(10))).toBe(false); // Sunday
    expect(inWindow({ from: '09:00', to: '17:00', weekdays: [0] }, at(10))).toBe(true);
    // 01:00 Monday belongs to the window that began Sunday 22:00
    expect(inWindow({ from: '22:00', to: '06:00', weekdays: [0] }, at(1, 0, 2))).toBe(true);
  });
});
