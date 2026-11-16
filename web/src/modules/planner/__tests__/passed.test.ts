/**
 * A training with a time whose day passed unlogged (`passed.ts`): today's page asks once – „Training vom Sa –
 * eintragen?“ – for the last week only; let go (`skipped`), logged or older, it is gone. The run never sees it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { PlannableEntry } from '@/core/modules/contributions';
import { setNow } from '@/core/time/now';
import { passedFixed, passedWindow, PASSED_DAYS } from '../passed';
import { itemRepo } from '../repo';
import { requestedIds, runPlanner, type RunDeps } from '../run';
import { itemSchema } from '../schema';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const TODAY = '2026-11-16'; // Monday
const SAT = '2026-11-14';

const training = (over: Partial<PlannableEntry> = {}): PlannableEntry => ({
  moduleId: 'fitness',
  id: 's1',
  kind: 'training',
  title: 'Training: Oberkörper',
  to: '/fitness?open=s1',
  durationMin: 60,
  earliest: SAT,
  fixed: { from: '18:00' },
  createdAt: 1,
  ...over,
});

describe('passedFixed', () => {
  it('asks from a week back to yesterday', () => {
    expect(passedWindow(TODAY)).toEqual({ today: '2026-11-09', until: '2026-11-15' });
    expect(PASSED_DAYS).toBe(7);
  });

  it('a past unlogged training with a time is asked once, oldest first', () => {
    const a = training();
    const b = training({ id: 's2', earliest: '2026-11-10', fixed: { from: '07:00' } });
    const out = passedFixed([a, b], [], TODAY);
    expect(out.map((p) => [p.entry.id, p.date, p.from])).toEqual([
      ['s2', '2026-11-10', '07:00'],
      ['s1', SAT, '18:00'],
    ]);
  });

  it('logged, let go for that day, older than a week, today or ahead: none', () => {
    expect(passedFixed([training({ done: true })], [], TODAY)).toEqual([]);
    expect(passedFixed([training()], [{ id: 'fitness:s1', skipped: SAT }], TODAY)).toEqual([]);
    expect(passedFixed([training({ earliest: '2026-11-08' })], [], TODAY)).toEqual([]);
    expect(passedFixed([training({ earliest: TODAY })], [], TODAY)).toEqual([]);
    expect(passedFixed([training({ earliest: '2026-11-17' })], [], TODAY)).toEqual([]);
  });

  it('let go on one day asks again once the session moved to another past day', () => {
    const moved = training({ earliest: '2026-11-13' });
    expect(passedFixed([moved], [{ id: 'fitness:s1', skipped: SAT }], TODAY)).toHaveLength(1);
  });

  it('only a training with a time: no time, a plan day or another kind is no question', () => {
    const { fixed: _f, ...untimed } = training();
    void _f;
    expect(passedFixed([untimed], [], TODAY)).toEqual([]);
    expect(passedFixed([training({ kind: 'task', moduleId: 'todos' })], [], TODAY)).toEqual([]);
  });

  it('a let-go row is no request into the plan', () => {
    const row = itemSchema.parse({ source: { module: 'fitness', id: 's1' }, skipped: SAT });
    expect(row.skipped).toBe(SAT);
    expect(requestedIds([row])).toEqual({});
  });
});

describe('the run and a passed training', () => {
  afterEach(async () => {
    setNow();
    await Promise.all(db.tables.map((tb) => tb.clear()));
  });

  it('never in a day, never late, never waiting; a run keeps the let-go mark', async () => {
    setNow(() => new Date(2026, 10, 16, 9, 0).getTime());
    await itemRepo.upsert('fitness:s1', {
      source: { module: 'fitness', id: 's1' },
      skipped: SAT,
      order: 0,
    });
    const deps: RunDeps = {
      today: TODAY,
      manifests: [],
      settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' },
      planLimit: 3,
      settled: true,
      entries: [training()],
      blocks: [],
      calendar: [],
      writer: { onAssign: vi.fn(async () => undefined), onRelease: vi.fn(async () => undefined) },
    };
    const out = await runPlanner(deps, { force: true });
    expect(out.result!.assignments).toEqual([]);
    expect(out.result!.unplaced).toEqual([]);
    expect(Object.values(out.result!.load).every((l) => l.planned === 0)).toBe(true);
    expect((await itemRepo.get('fitness:s1'))?.skipped).toBe(SAT);
  });
});
