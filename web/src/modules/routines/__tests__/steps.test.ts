// @vitest-environment jsdom
/**
 * A routine's steps in the planner (planner hub 2, package 5a): the steps of the turn due now, ticked ones in place; a
 * tick from the plan writes only that turn's progress, and never a turn that was finished elsewhere meanwhile.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { undoable, undoLast } from '@/core/undo';
import source from '../plannable';
import { routineRepo } from '../repo';

const TODAY = '2026-09-29';
const weekly = { freq: 'weekly' as const, interval: 1 };
const steps = ['Wäsche anstellen', 'Bad wischen', 'Müll rausbringen'].map((text, i) => ({
  id: `s${i}`,
  text,
}));

beforeEach(async () => {
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  await db.table('routines_routine').clear();
});

describe("a routine's steps", () => {
  it("hands over the turn's steps; a tick from the plan is that turn's progress", async () => {
    const r = await routineRepo.create({
      name: 'Haushalt',
      repeat: weekly,
      startDate: TODAY,
      dueDate: TODAY,
      people: [],
      turn: 0,
      steps,
      // A tick of an earlier turn does not count now.
      progress: { day: '2026-09-22', done: ['s0'] },
    });
    const [row] = await source.list({ today: TODAY, until: '2026-10-05' });
    expect(row?.steps?.map((s) => [s.title, s.done])).toEqual([
      ['Wäsche anstellen', false],
      ['Bad wischen', false],
      ['Müll rausbringen', false],
    ]);
    await source.onStepDone!(row!.id, 's1', true);
    const [after] = await source.list({ today: TODAY, until: '2026-10-05' });
    expect(after?.steps?.map((s) => s.done)).toEqual([false, true, false]);
    // The turn moved on elsewhere (another device ticked it): the old row's tick writes nothing.
    await routineRepo.update(r.id, { dueDate: '2026-10-06' });
    const before = JSON.stringify(await routineRepo.get(r.id));
    await source.onStepDone!(row!.id, 's2', true);
    expect(JSON.stringify(await routineRepo.get(r.id))).toBe(before);
  });

  it('a later turn has no steps yet; a step already in that state writes nothing', async () => {
    await routineRepo.create({
      name: 'Haushalt',
      repeat: weekly,
      startDate: '2026-10-01',
      dueDate: '2026-10-01',
      people: [],
      turn: 0,
      steps,
    });
    const [later] = await source.list({ today: TODAY, until: '2026-10-05' });
    expect(later).toBeDefined();
    expect(later).not.toHaveProperty('steps');
    setNow(() => new Date('2026-10-01T10:00:00').getTime());
    const [now] = await source.list({ today: '2026-10-01', until: '2026-10-05' });
    expect(now?.steps).toHaveLength(3);
    const before = JSON.stringify(await routineRepo.get(now!.id.split(':')[0]!));
    await source.onStepDone!(now!.id, 's0', false);
    expect(JSON.stringify(await routineRepo.get(now!.id.split(':')[0]!))).toBe(before);
  });

  it("a step's undo takes back only that step (another one ticked since stays)", async () => {
    await routineRepo.create({
      name: 'Haushalt',
      repeat: weekly,
      startDate: TODAY,
      dueDate: TODAY,
      people: [],
      turn: 0,
      steps,
    });
    const [row] = await source.list({ today: TODAY, until: '2026-10-05' });
    await undoable('step', () => source.onStepDone!(row!.id, 's0', true));
    await source.onStepDone!(row!.id, 's1', true);
    await undoLast();
    const [after] = await source.list({ today: TODAY, until: '2026-10-05' });
    expect(after?.steps?.map((s) => s.done)).toEqual([false, true, false]);
  });
});
