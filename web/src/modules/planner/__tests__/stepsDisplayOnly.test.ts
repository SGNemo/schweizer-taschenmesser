import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { plannerRepos } from '../repo';
import { buildInputs, runPlanner, type RunDeps } from '../run';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

/**
 * Steps are display and „Los“ only (planner hub 2, package 5a, CONCEPT-ROWS idea 5): a thing's steps – also one ticked
 * or added – never enter the input hash and never move a thing; a source may hand them over or change them without a
 * replan.
 */
const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();

const plain: PlannableEntry[] = [
  {
    moduleId: 'todos',
    id: 'a',
    kind: 'task',
    title: 'Haushalt',
    to: '/todos?open=a',
    durationMin: 30,
    priority: 2,
    createdAt: 1,
  },
];
const withSteps = (done: boolean[]): PlannableEntry[] => [
  {
    ...plain[0]!,
    steps: ['Wäsche anstellen', 'Bad wischen', 'Müll rausbringen'].map((title, i) => ({
      id: `c${i}`,
      title,
      done: done[i] ?? false,
    })),
  },
];

const deps = (database: RunDeps['database'], entries: PlannableEntry[]): RunDeps => ({
  database,
  today: TODAY,
  manifests: [],
  settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const },
  planLimit: 3,
  settled: true,
  entries,
  calendar: [],
  writer: { onAssign: vi.fn(async () => undefined), onRelease: vi.fn(async () => undefined) },
});

beforeEach(() => setNow(() => NOW));
afterEach(() => setNow());

describe('steps are display only', () => {
  it('the input hash and the engine items are the same with and without steps, ticked or not', async () => {
    const database = createTestDb();
    const a = await buildInputs(deps(database, plain), plannerRepos(database));
    for (const done of [[], [true], [true, true, true]]) {
      const b = await buildInputs(deps(database, withSteps(done)), plannerRepos(database));
      expect(b.hash).toBe(a.hash);
      expect(b.items).toEqual(a.items);
    }
    await database.delete();
  });

  it('a step ticked after the plan was laid is no reason to plan again', async () => {
    const database = createTestDb();
    const first = await runPlanner(deps(database, withSteps([])), { force: true, reshuffle: true });
    expect(first.rowWrites).toBeGreaterThan(0);
    const again = await runPlanner(deps(database, withSteps([true, false, true])));
    expect(again.ran).toBe(false);
    expect(again.rowWrites).toBe(0);
    await database.delete();
  });
});
