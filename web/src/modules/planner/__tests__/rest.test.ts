/**
 * „Rest verteilen“ (use case „Wochenende retten“, package 3): the ops of `moveAll(today, tomorrow)` on the
 * engine – today empties but for a pinned thing, the ops leave a hard due of today alone, the result is
 * deterministic and a fixpoint.
 */
import { describe, expect, it } from 'vitest';
import { plan } from '@/core/plan/engine';
import {
  parseInstruction,
  restToTomorrow,
  type InstructionContext,
} from '@/core/plan/instructions';
import {
  DEFAULT_PLAN_SETTINGS,
  type PlanDay,
  type PlanInput,
  type PlanItem,
  type PlanResult,
} from '@/core/plan/types';
import { withOps } from '../run';

const SAT = '2026-11-14';
const SUN = '2026-11-15';
const days = (avail: number[]): PlanDay[] =>
  avail.map((availableMin, i) => ({
    date: `2026-11-${String(14 + i).padStart(2, '0')}`,
    availableMin,
    blockers: [],
  }));
const item = (key: string, over: Partial<PlanItem> = {}): PlanItem => ({
  key: `todos:${key}`,
  priority: 0,
  durationMin: 30,
  createdAt: key.charCodeAt(0),
  ...over,
});
const shape = (r: PlanResult) => r.assignments.map((a) => [a.id, a.date, a.order] as const).sort();
const settings = { ...DEFAULT_PLAN_SETTINGS, horizonDays: 7, bufferShare: 0, mainPerDay: 10 };

/** Saturday: three things today, one pinned to today, one due hard today; Sunday and Monday have time. */
const items = [
  item('a'),
  item('b'),
  item('c'),
  item('pin', { pinned: SAT }),
  item('due', { due: { date: SAT, hard: true } }),
];
const base = {
  today: SAT,
  days: days([300, 240, 240, 240, 240, 240, 240]),
  items,
  settings,
} satisfies PlanInput;
const first = plan(base);
const ctx = (r: PlanResult): InstructionContext => ({
  today: SAT,
  items: items.map((i) => {
    const d = r.assignments
      .filter((a) => a.itemKey === i.key)
      .map((a) => a.date)
      .sort()[0];
    return {
      key: i.key,
      title: i.key,
      ...(d ? { date: d } : {}),
      ...(i.due?.hard ? { hardDue: i.due.date } : {}),
      ...(i.pinned ? { pinned: i.pinned } : {}),
    };
  }),
});

describe('restToTomorrow', () => {
  it('is the ops of moveAll(today, tomorrow): today 0, each open thing of today not before tomorrow', () => {
    expect(shape(first).every(([, date]) => date === SAT)).toBe(true);
    expect(restToTomorrow(ctx(first))).toEqual([
      { op: 'available', date: SAT, min: 0 },
      { op: 'earliest', key: 'todos:a', date: SUN },
      { op: 'earliest', key: 'todos:b', date: SUN },
      { op: 'earliest', key: 'todos:c', date: SUN },
    ]);
  });

  it('the field reads „Rest verteilen“ and „Rest auf morgen“ as the same ops', () => {
    const want = restToTomorrow(ctx(first));
    for (const text of ['Rest verteilen', 'rest auf morgen', 'Den Rest auf morgen schieben'])
      expect(parseInstruction(text, ctx(first))).toEqual({ kind: 'ops', ops: want });
  });

  it('after it only the pinned thing is left today; the hard-due one, untouched by the ops, is late on Sunday; deterministic and a fixpoint', () => {
    const next = withOps(base, restToTomorrow(ctx(first)));
    const input: PlanInput = {
      ...base,
      days: next.days,
      items: next.items,
      prev: first.assignments,
    };
    const after = plan(input);
    expect(plan(input)).toEqual(after);
    const today = after.assignments
      .filter((a) => a.date === SAT)
      .map((a) => a.itemKey)
      .sort();
    expect(today).toEqual(['todos:pin']);
    // The ops leave a hard due of today alone; with no time left today the run places it on the next day with
    // room and says it is late („Frist war Sa“) – honest, never hidden.
    expect(after.assignments.find((a) => a.itemKey === 'todos:due')).toMatchObject({
      date: SUN,
      late: true,
    });
    for (const k of ['todos:a', 'todos:b', 'todos:c'])
      expect(after.assignments.find((a) => a.itemKey === k)?.date).toBe(SUN);
    const again = plan({ ...input, prev: after.assignments });
    expect(shape(again)).toEqual(shape(after));
    expect(again.diff.moved).toHaveLength(0);
  });
});
