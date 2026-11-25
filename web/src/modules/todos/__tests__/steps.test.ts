/**
 * A ToDo's checklist as steps in the planner (planner hub 2, package 5a): in order, ticked ones in place; a tick from the
 * plan writes that line only, read fresh – another line changed meanwhile keeps its change.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import source from '../plannable';
import { taskRepo } from '../repo';

beforeEach(async () => {
  await db.table('todos_task').clear();
});

describe("a ToDo's steps", () => {
  it('hands over its checklist; a tick from the plan writes one line, read fresh', async () => {
    const task = await taskRepo.create({
      listId: 'inbox',
      title: 'Haushalt',
      done: false,
      priority: 0,
      order: 0,
      checklist: [
        { id: 'c1', text: 'Wäsche anstellen', done: false },
        { id: 'c2', text: 'Bad wischen', done: true },
      ],
    } as never);
    const [row] = await source.list({ today: '2026-11-30', until: '2026-12-13' });
    expect(row?.steps).toEqual([
      { id: 'c1', title: 'Wäsche anstellen', done: false },
      { id: 'c2', title: 'Bad wischen', done: true },
    ]);
    // Another device unticked c2 meanwhile: ticking c1 keeps that.
    await taskRepo.update(task.id, {
      checklist: [
        { id: 'c1', text: 'Wäsche anstellen', done: false },
        { id: 'c2', text: 'Bad wischen', done: false },
      ],
    });
    await source.onStepDone!(task.id, 'c1', true);
    expect((await taskRepo.get(task.id))?.checklist?.map((c) => c.done)).toEqual([true, false]);
  });

  it('a ToDo without a checklist has no steps', async () => {
    await taskRepo.create({
      listId: 'inbox',
      title: 'Anrufen',
      done: false,
      priority: 0,
      order: 0,
    } as never);
    const [row] = await source.list({ today: '2026-11-30', until: '2026-12-13' });
    expect(row).not.toHaveProperty('steps');
  });
});
