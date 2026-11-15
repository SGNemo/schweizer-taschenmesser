/**
 * Package 4 of „Wochenende retten“ (F2) in the module: the v3 step keeps old rows, the part goes to the engine,
 * „Als Pause“ is never a unit and blocks its length on its day, the field reads „Duschen nachmittags“.
 */
import { describe, expect, it } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { parseInstruction } from '@/core/plan/instructions';
import { breakBlockers, planDays } from '../days';
import manifest from '../manifest';
import { migrations } from '../migrations';
import { buildInputs, runPlanner, type RunDeps } from '../run';
import { daySchema, itemSchema } from '../schema';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';
import { plannerRepos } from '../repo';

const SAT = '2026-11-14';
const entry = (id: string, title: string, over: Partial<PlannableEntry> = {}): PlannableEntry =>
  ({ moduleId: 'todos', id, title, to: '/todos', createdAt: 1, ...over }) as PlannableEntry;

describe('v3 rows', () => {
  it('the step is recorded; old item and day rows parse unchanged (nothing set = as before)', () => {
    expect(manifest.version).toBe(3);
    expect(Object.keys(migrations ?? {})).toEqual(['2', '3']);
    const oldItem = { source: { module: 'todos', id: 'a' }, pinned: SAT, order: 0 };
    expect(itemSchema.parse(oldItem)).toEqual(oldItem);
    const oldDay = {
      date: SAT,
      availableMin: 120,
      blockers: [{ id: 'x', label: 'Werkstatt', min: 60 }],
    };
    expect(daySchema.parse(oldDay)).toEqual(oldDay);
    expect(itemSchema.safeParse({ ...oldItem, part: 'nachts' }).success).toBe(false);
    expect(
      itemSchema.safeParse({ ...oldItem, asBreakOn: SAT, breakMin: 120, part: 'afternoon' })
        .success,
    ).toBe(true);
  });
});

describe('„Als Pause“', () => {
  const rows = [
    {
      id: 'todos:z',
      source: { module: 'todos', id: 'z' },
      asBreakOn: SAT,
      breakMin: 120,
      part: 'afternoon' as const,
      order: 0,
    },
  ];
  const entries = [entry('z', 'Zocken'), entry('d', 'Duschen')];

  it('becomes a blocker of its day with its title, length and part; none once the thing is done', () => {
    expect(breakBlockers(rows, entries)).toEqual([
      { date: SAT, label: 'Zocken', min: 120, itemKey: 'todos:z', part: 'afternoon' },
    ]);
    expect(breakBlockers(rows, [entry('z', 'Zocken', { done: true })])).toEqual([]);
    const [sat] = planDays({
      today: SAT,
      span: 2,
      settings: DEFAULT_PLANNER_SETTINGS,
      dayRows: [],
      calendar: [],
      breaks: breakBlockers(rows, entries),
    });
    expect(sat!.blockers).toEqual([
      {
        id: 'break:todos:z',
        label: 'Zocken',
        min: 120,
        part: 'afternoon',
        calendar: false,
        breakOf: 'todos:z',
      },
    ]);
  });

  it('is never a unit and blocks its length; after its day it is an ordinary thing again', async () => {
    const deps = (today: string): RunDeps => ({
      today,
      manifests: [],
      settings: { ...DEFAULT_PLANNER_SETTINGS, availableSaturday: 360, bufferShare: '0' },
      planLimit: 3,
      settled: true,
      entries,
      calendar: [],
      writer: { onAssign: async () => undefined, onRelease: async () => undefined },
    });
    const repos = plannerRepos();
    await repos.item.upsert('todos:z', rows[0]!);
    const inputs = await buildInputs(deps(SAT), repos);
    expect(inputs.items.find((i) => i.key === 'todos:z')?.excluded).toBe(true);
    expect(inputs.days[0]!.blockers.map((b) => [b.label, b.min])).toEqual([['Zocken', 120]]);
    const out = await runPlanner(deps(SAT), { force: true });
    expect(out.result!.assignments.some((a) => a.itemKey === 'todos:z')).toBe(false);
    expect(out.result!.load[SAT]!.raw).toBe(360 - 120);
    const later = await buildInputs(deps('2026-11-15'), repos);
    expect(later.items.find((i) => i.key === 'todos:z')?.excluded).toBeUndefined();
    await repos.item.remove('todos:z');
  });
});

describe('the field', () => {
  const ctx = {
    today: SAT,
    items: [
      { key: 'todos:d', title: 'Duschen', date: SAT },
      { key: 'todos:b', title: 'Bude aufräumen', date: SAT },
    ],
  };
  it.each([
    ['Duschen nachmittags', 'todos:d', 'afternoon'],
    ['Bude abends', 'todos:b', 'evening'],
    ['Duschen am Vormittag', 'todos:d', 'morning'],
  ])('%s → part', (text, key, part) => {
    expect(parseInstruction(text, ctx)).toEqual({ kind: 'ops', ops: [{ op: 'part', key, part }] });
  });
  it('„Duschen 15 Min“ is the length; an unknown thing with a part stays a ToDo', () => {
    expect(parseInstruction('Duschen 15 Min', ctx)).toEqual({
      kind: 'ops',
      ops: [{ op: 'duration', key: 'todos:d', min: 15 }],
    });
    expect(parseInstruction('Zocken nachmittags', ctx)).toEqual({ kind: 'none' });
  });
});
