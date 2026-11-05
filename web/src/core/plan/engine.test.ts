import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { calendarBlockers, capacity } from './capacity';
import { plan } from './engine';
import s1 from './__fixtures__/s1.json';
import s2 from './__fixtures__/s2.json';
import s3 from './__fixtures__/s3.json';
import s4 from './__fixtures__/s4.json';
import s5 from './__fixtures__/s5.json';
import type { PlanDay, PlanInput, PlanItem, PlanResult } from './types';
import { toUnits } from './units';

/** One scenario as the prototype wrote it (`__fixtures__/*.json`). */
interface Fixture {
  title: string;
  input: unknown;
  expected: {
    assignments: (string | number)[][];
    reasons: Record<string, string>;
    unplaced: { id: string; reason: string }[];
    diff: {
      added: number;
      moved: number;
      removed: number;
      unchanged: number;
      movedReasons: { id: string; from: string; to: string; reason: string; by: string[] }[];
      removedReasons: { id: string; from: string; reason: string; by: string[] }[];
    };
    free: Record<string, number>;
    overflowMin: number;
    demandMin: number;
    usableMin: number;
  };
}
const FIXTURES: [string, Fixture][] = [
  ['s1', s1 as Fixture],
  ['s2', s2 as Fixture],
  ['s3', s3 as Fixture],
  ['s4', s4 as Fixture],
  ['s5', s5 as Fixture],
];
const input = (f: Fixture): PlanInput => f.input as PlanInput;
/** The shape the fixpoint and the fixtures compare: (unit, date, minutes, order), sorted. */
const shape = (r: PlanResult) =>
  r.assignments.map((a) => [a.id, a.date, a.minutes, a.order] as const).sort();

const MON = '2026-11-09';
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
const H = { horizonDays: 7 };

describe('fixtures from the prototype (engine-proto.mjs, horizon 7 days)', () => {
  it.each(FIXTURES)('%s places the same (unit, day, minutes, order)', (_name, f) => {
    const r = plan(input(f));
    expect(shape(r)).toEqual(f.expected.assignments);
    expect(Object.fromEntries(r.assignments.map((a) => [a.id, a.reason]))).toEqual(
      f.expected.reasons,
    );
    expect(r.unplaced.map((u) => ({ id: u.id, reason: u.reason }))).toEqual(f.expected.unplaced);
    expect(r.diff.added).toHaveLength(f.expected.diff.added);
    expect(r.diff.unchanged).toBe(f.expected.diff.unchanged);
    expect(r.diff.moved.map((m) => ({ ...m, by: m.by ?? [] }))).toEqual(
      f.expected.diff.movedReasons,
    );
    expect(r.diff.removed.map((m) => ({ ...m, by: m.by ?? [] }))).toEqual(
      f.expected.diff.removedReasons,
    );
    expect(Object.fromEntries(Object.entries(r.load).map(([d, l]) => [d, l.free]))).toEqual(
      f.expected.free,
    );
    expect(r.overflowMin).toBe(f.expected.overflowMin);
    expect(r.demandMin).toBe(f.expected.demandMin);
    expect(r.usableMin).toBe(f.expected.usableMin);
  });

  it('S1: Monday has 47 minutes free, Friday stays free, the bike waits for Saturday', () => {
    const r = plan(input(s1));
    expect(r.load[MON]!.free).toBe(47);
    expect(r.load['2026-11-13']!.planned).toBe(0);
    expect(r.assignments.find((a) => a.itemKey === 'todos:h')?.date).toBe('2026-11-14');
    expect(r.overflowMin).toBe(0);
  });

  it('S3: the free Thursday pulls the deadline work onto Wednesday and the overload is a number', () => {
    const r = plan(input(s3));
    expect(r.assignments.filter((a) => a.itemKey === 'todos:a').map((a) => a.date)).toEqual([
      '2026-11-11',
      '2026-11-11',
    ]);
    expect(r.overflowMin).toBe(160);
    expect(r.unplaced.map((u) => u.id).sort()).toEqual(['todos:d#0', 'todos:d#1', 'todos:f#0']);
  });

  it('S4: a hard due beyond the horizon is not pressure inside it', () => {
    const r = plan(input(s4));
    const k = r.assignments.find((a) => a.itemKey === 'todos:k');
    expect(k?.reason).toBe('new');
    expect(k?.date).toBe('2026-11-10');
  });

  it('S5: a done item frees room and nothing is pulled forward', () => {
    const r = plan(input(s5));
    expect(r.diff.moved).toHaveLength(0);
    expect(r.diff.removed).toEqual([{ id: 'todos:c#0', from: MON, reason: 'done' }]);
    expect(r.load[MON]!.free).toBe(92);
  });
});

describe('determinism and fixpoint', () => {
  it.each(FIXTURES)('%s: the same input gives the same output twice', (_name, f) => {
    expect(plan(input(f))).toEqual(plan(input(f)));
  });

  it.each(FIXTURES)(
    '%s: plan(x, prev = plan(x)) has the same (unit, day, minutes, order)',
    (_name, f) => {
      const x = input(f);
      const first = plan(x);
      const again = plan({ ...x, prev: first.assignments });
      expect(shape(again)).toEqual(shape(first));
      expect(again.diff.moved).toHaveLength(0);
      expect(again.diff.added).toHaveLength(0);
      // A unit that keeps its day keeps its reason („Warum hier?“ does not flicker).
      expect(again.assignments.map((a) => [a.id, a.reason]).sort()).toEqual(
        first.assignments.map((a) => [a.id, a.reason]).sort(),
      );
    },
  );

  it('the Monday story: Steuer arrives on a planned Monday, then the plan is a fixpoint', () => {
    const x = input(s1);
    const monday0 = plan({ ...x, items: x.items.filter((i) => i.key !== 'todos:a') });
    const withSteuer = plan({ ...x, prev: monday0.assignments });
    const again = plan({ ...x, prev: withSteuer.assignments });
    expect(shape(again)).toEqual(shape(withSteuer));
    expect(again.diff.moved).toHaveLength(0);
  });
});

describe('stability (rule 6)', () => {
  it('a kept unit never loses its day to a carried one of the same priority', () => {
    const days = week([60, 60, 60, 60, 60, 0, 0]);
    const items = [
      item('kept', { durationMin: 40, priority: 2, createdAt: 2 }),
      item('carried', { durationMin: 40, priority: 2, createdAt: 1 }),
    ];
    // Yesterday: "carried" was planned for Monday, "kept" for Tuesday. Today is Tuesday.
    const prev = [
      { id: 'todos:carried#0', date: MON, reason: 'new' as const },
      { id: 'todos:kept#0', date: '2026-11-10', reason: 'new' as const },
    ];
    const r = plan({ today: '2026-11-10', days, items, prev, settings: H });
    expect(r.assignments.find((a) => a.itemKey === 'todos:kept')?.date).toBe('2026-11-10');
    expect(r.assignments.find((a) => a.itemKey === 'todos:kept')?.reason).toBe('new');
    expect(r.assignments.find((a) => a.itemKey === 'todos:carried')?.date).toBe('2026-11-11');
    expect(r.diff.moved).toEqual([
      { id: 'todos:carried#0', from: MON, to: '2026-11-11', reason: 'carried' },
    ]);
  });

  it('a new item of the same priority never displaces a planned one', () => {
    const days = week([60, 60, 60, 60, 60, 0, 0]);
    const old = item('old', { durationMin: 40, priority: 2, createdAt: 5 });
    const first = plan({ today: MON, days, items: [old], settings: H });
    const r = plan({
      today: MON,
      days,
      items: [old, item('new', { durationMin: 40, priority: 2, createdAt: 1 })],
      prev: first.assignments,
      settings: H,
    });
    expect(r.assignments.find((a) => a.itemKey === 'todos:old')?.date).toBe(MON);
    expect(r.assignments.find((a) => a.itemKey === 'todos:new')?.date).toBe('2026-11-10');
    expect(r.diff.moved).toHaveLength(0);
  });

  it('a higher priority takes the room and the diff names it, never a session of the same item', () => {
    const days = week([60, 60, 0, 0, 0, 0, 0]);
    const low = item('low', { durationMin: 40, priority: 1, createdAt: 5 });
    const first = plan({ today: MON, days, items: [low], settings: H });
    const r = plan({
      today: MON,
      days,
      items: [low, item('high', { durationMin: 40, priority: 3, createdAt: 9 })],
      prev: first.assignments,
      settings: H,
    });
    expect(r.diff.moved).toEqual([
      { id: 'todos:low#0', from: MON, to: '2026-11-10', reason: 'bumped', by: ['todos:high#0'] },
    ]);
    for (const m of r.diff.moved) expect(m.by).not.toContain(m.id);
  });

  it('a drop-out names its cause too; a later session names its part', () => {
    const r = plan(input(s2));
    const keller2 = r.diff.removed.find((x) => x.id === 'todos:d#1');
    expect(keller2).toMatchObject({ reason: 'after-part', by: ['todos:d#0'] });
    const steuer2 = r.diff.moved.find((x) => x.id === 'todos:a#1');
    expect(steuer2).toMatchObject({ reason: 'after-part', by: ['todos:a#0'] });
    // „Platz nahmen …“ never names a session of the same item; only „folgt auf Teil 1“ points at one.
    for (const m of [...r.diff.moved, ...r.diff.removed].filter((x) => x.reason === 'bumped'))
      for (const by of m.by ?? []) expect(by.split('#')[0]).not.toBe(m.id.split('#')[0]);
  });
});

describe('deadline (rule 4)', () => {
  it('a hard due inside the horizon is met when the capacity allows, even against priority', () => {
    const days = week([60, 60, 60, 60, 60, 0, 0]);
    const items = [
      item('big', { durationMin: 45, priority: 3, createdAt: 1 }),
      item('due', { durationMin: 45, priority: 0, due: { date: MON, hard: true }, createdAt: 2 }),
    ];
    const r = plan({ today: MON, days, items, settings: H });
    expect(r.assignments.find((a) => a.itemKey === 'todos:due')).toMatchObject({
      date: MON,
      reason: 'deadline',
    });
    expect(r.assignments.find((a) => a.itemKey === 'todos:big')?.date).toBe('2026-11-10');
  });

  it('a soft due is only a tie-break, never pressure', () => {
    const days = week([60, 60, 60, 60, 60, 0, 0]);
    const items = [
      item('big', { durationMin: 45, priority: 3, createdAt: 1 }),
      item('soft', { durationMin: 45, priority: 0, due: { date: MON, hard: false }, createdAt: 2 }),
    ];
    const r = plan({ today: MON, days, items, settings: H });
    expect(r.assignments.find((a) => a.itemKey === 'todos:soft')?.date).toBe('2026-11-10');
  });

  it('a due that cannot be met is placed anyway and flagged late', () => {
    const days = week([0, 0, 60, 0, 0, 0, 0]);
    const items = [item('late', { durationMin: 40, due: { date: MON, hard: true } })];
    const r = plan({ today: MON, days, items, settings: H });
    const a = r.assignments[0]!;
    expect(a).toMatchObject({ date: '2026-11-11', late: true });
    expect(r.unplaced).toEqual([
      expect.objectContaining({ id: 'todos:late#0', reason: 'after-hard-due', due: MON }),
    ]);
  });

  it('the deadline is the only rule that pulls a unit forward', () => {
    const days = week([120, 120, 120, 120, 120, 0, 0]);
    const x = item('x', { durationMin: 60, priority: 1 });
    const prev = [{ id: 'todos:x#0', date: '2026-11-12', reason: 'new' as const }];
    const calm = plan({ today: MON, days, items: [x], prev, settings: H });
    expect(calm.assignments[0]?.date).toBe('2026-11-12');
    const pressed = plan({
      today: MON,
      days,
      items: [{ ...x, due: { date: '2026-11-10', hard: true } }],
      prev,
      settings: H,
    });
    expect(pressed.assignments[0]).toMatchObject({ date: '2026-11-10', reason: 'deadline' });
    expect(pressed.diff.moved[0]).toMatchObject({ reason: 'pulled' });
  });
});

describe('buffer, split, limit (rules 1, 2, 5)', () => {
  it('the usable minutes are never exceeded except by a deadline or a pin', () => {
    const r1 = plan(input(s1));
    for (const l of Object.values(r1.load)) expect(l.planned).toBeLessThanOrEqual(l.usable);
    expect(capacity({ date: MON, availableMin: 240, blockers: [] }, { bufferShare: 0.2 })).toEqual({
      raw: 240,
      usable: 192,
      blocked: 0,
    });
    const r = plan({
      today: MON,
      days: week([60, 0, 0, 0, 0, 0, 0]),
      items: [item('d', { durationMin: 55, due: { date: MON, hard: true } })],
      settings: H,
    });
    expect(r.assignments[0]?.reason).toBe('deadline-buffer');
    expect(r.load[MON]).toMatchObject({ usable: 48, planned: 55, over: 7, free: 0 });
  });

  it('a pin is placed whatever the capacity and the overload is counted', () => {
    const r = plan({
      today: MON,
      days: week([30, 240, 240, 240, 240, 0, 0]),
      items: [item('p', { durationMin: 90, pinned: MON })],
      settings: H,
    });
    expect(r.assignments[0]).toMatchObject({ date: MON, reason: 'pinned' });
    expect(r.load[MON]!.over).toBe(66);
  });

  it('long items split into sessions ≤ max on different days; an item without estimate counts 30', () => {
    const units = toUnits(item('big', { durationMin: 200, splittable: true }), {
      maxSessionMin: 90,
      minSessionMin: 25,
    });
    expect(units.map((u) => [u.id, u.minutes, u.of])).toEqual([
      ['todos:big#0', 67, 3],
      ['todos:big#1', 67, 3],
      ['todos:big#2', 66, 3],
    ]);
    expect(toUnits(item('n'), { maxSessionMin: 90, minSessionMin: 25 })[0]?.minutes).toBe(30);
    const r = plan({
      today: MON,
      days: week(),
      items: [item('big', { durationMin: 200, splittable: true })],
      settings: H,
    });
    expect(new Set(r.assignments.map((a) => a.date)).size).toBe(3);
  });

  it('at most planLimit main items per day; small things fill the rest', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      item(`m${i}`, { durationMin: 30, priority: 2, createdAt: i }),
    ).concat(item('tiny', { durationMin: 10, priority: 0, createdAt: 9 }));
    const r = plan({ today: MON, days: week(), items, settings: { ...H, mainPerDay: 3 } });
    const monday = r.assignments.filter((a) => a.date === MON);
    expect(monday.filter((a) => a.minutes >= 30)).toHaveLength(3);
    expect(monday.find((a) => a.itemKey === 'todos:tiny')).toBeDefined();
    expect(r.load[MON]!.mains).toBe(3);
  });

  it('items without room wait with an honest reason', () => {
    const r = plan({
      today: MON,
      days: week([60, 0, 0, 0, 0, 0, 0]),
      items: [
        item('fits', { durationMin: 40, createdAt: 1 }),
        item('nothing', { durationMin: 40, createdAt: 2 }),
        item('huge', { durationMin: 400, createdAt: 3 }),
      ],
      settings: H,
    });
    expect(r.unplaced.map((u) => [u.id, u.reason])).toEqual([
      ['todos:nothing#0', 'horizon'],
      ['todos:huge#0', 'too-long'],
    ]);
    expect(r.overflowMin).toBe(40 + 40 + 400 - 48);
  });

  it('the horizon slices the days and an excluded or done item takes no room', () => {
    const r = plan({
      today: MON,
      days: week(),
      items: [item('x', { excluded: true }), item('y', { done: true }), item('z')],
      settings: { horizonDays: 2 },
    });
    expect(Object.keys(r.load)).toEqual([MON, '2026-11-10']);
    expect(r.assignments.map((a) => a.itemKey)).toEqual(['todos:z']);
  });
});

describe('blockers (rule 1)', () => {
  const cal = (over: Partial<CalendarItem>): CalendarItem => ({
    id: 'i',
    source: 'calendar',
    kind: 'event',
    title: 'Termin',
    date: MON,
    allDay: false,
    time: '10:00',
    endTime: '11:30',
    ...over,
  });

  it('only timed events and external appointments block; reminders, tasks, done and all-day never', () => {
    const blockers = calendarBlockers([
      cal({ id: 'a' }),
      cal({ id: 'b', kind: 'external', endTime: undefined }),
      cal({ id: 'c', kind: 'reminder' }),
      cal({ id: 'd', kind: 'task', source: 'todos' }),
      cal({ id: 'e', done: true }),
      cal({ id: 'f', allDay: true, time: undefined }),
      cal({ id: 'g', kind: 'plan', source: 'planner' }),
    ]);
    expect(blockers.map((b) => [b.id, b.min])).toEqual([
      ['cal:calendar:a', 90],
      ['cal:calendar:b', 60],
    ]);
    expect(
      calendarBlockers([cal({ id: 'f', allDay: true, time: undefined })], { allDayBlocks: true }),
    ).toHaveLength(1);
  });

  it('a reminder at a planned hour changes nothing in the plan', () => {
    const x = input(s1);
    const withReminder = {
      ...x,
      days: x.days.map((d) =>
        d.date === MON
          ? { ...d, blockers: [...d.blockers, ...calendarBlockers([cal({ kind: 'reminder' })])] }
          : d,
      ),
    };
    expect(shape(plan(withReminder))).toEqual(shape(plan(x)));
  });
});
