import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { plannerRepos } from '../repo';
import { buildInputs, runPlanner, type RunDeps } from '../run';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

/**
 * Links, `action` and `detail` are display only (docs/design/planner-hub/CONCEPT-LINKS.md §1.6): they never
 * enter the input hash and never move a thing. A source may add or change them without causing a replan.
 */
const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();

const plain: PlannableEntry[] = [
  {
    moduleId: 'todos',
    id: 'a',
    kind: 'task',
    title: 'Vermieter antworten',
    to: '/todos?open=a',
    durationMin: 120,
    priority: 2,
    createdAt: 1,
  },
  {
    moduleId: 'invoices',
    id: 'inv-1',
    kind: 'invoice',
    title: 'Stadtwerke bezahlen',
    to: '/invoices?open=inv-1',
    durationMin: 10,
    priority: 2,
    due: { date: '2026-11-12', hard: true },
    createdAt: 2,
  },
];

const decorated: PlannableEntry[] = [
  {
    ...plain[0]!,
    link: { kind: 'mail', id: 't1', label: 'Frage zur Nebenkostenabrechnung' },
    links: [
      { to: { module: 'mail', id: 't1' }, rel: 'origin', label: 'Frage zur Nebenkostenabrechnung' },
      { to: { module: 'notes', id: 'n1' }, rel: 'about', label: 'Notizen' },
    ],
  },
  {
    ...plain[1]!,
    detail: 'Mahnung · 92,40 € bis 13.10.',
    action: { label: 'Bezahlt …', to: '/invoices?open=inv-1&do=pay' },
    links: [
      {
        to: { module: 'mail', id: 't2' },
        rel: 'dunning',
        label: 'Mahnung',
        on: '2026-11-03',
      },
    ],
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

describe('links, action and detail are display only', () => {
  it('the input hash and the engine items are the same with and without them', async () => {
    const database = createTestDb();
    const a = await buildInputs(deps(database, plain), plannerRepos(database));
    const b = await buildInputs(deps(database, decorated), plannerRepos(database));
    expect(b.hash).toBe(a.hash);
    expect(b.items).toEqual(a.items);
    await database.delete();
  });

  it('the stored plan is the same, and adding them later is no reason to plan again', async () => {
    const [one, two] = [createTestDb(), createTestDb()];
    const rows = async (database: typeof one) =>
      (await plannerRepos(database).assignment.active().toArray())
        .map((r) => [r.id, r.date, r.minutes, r.order, r.reason])
        .sort();
    const first = await runPlanner(deps(one, plain));
    await runPlanner(deps(two, decorated));
    expect(first.rowWrites).toBeGreaterThan(0);
    expect(await rows(two)).toEqual(await rows(one));
    // The source starts sending links: same hash, same rows → the run writes nothing.
    const again = await runPlanner(deps(one, decorated));
    expect(again.rowWrites).toBe(0);
    expect(await rows(one)).toEqual(await rows(two));
    await one.delete();
    await two.delete();
  });
});
