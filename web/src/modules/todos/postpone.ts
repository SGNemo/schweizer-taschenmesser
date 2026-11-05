/**
 * "Später": takes a task out of today in one step (the card, the row menu and the swipe use the same
 * rule). Calm by design: always "tomorrow", never a guilt-laden date. Pure; the caller writes the
 * patch inside one undoable action. The planner reads the new date as "earliest tomorrow", never as a
 * pin, so nothing piles up; its ownership mark goes with the date change (`userPlannedFor`).
 */
import { addDaysStr } from '@/core/time/dates';
import type { Task } from './schema';
import { userPlannedFor } from './views';

export type PostponePatch = Partial<Pick<Task, 'plannedFor' | 'planMark' | 'dueDate'>>;

export function postponePatch(
  task: Pick<Task, 'plannedFor' | 'dueDate' | 'planMark'>,
  day: string,
): PostponePatch {
  const tomorrow = addDaysStr(day, 1);
  const patch: PostponePatch = {};
  // A plan further ahead than tomorrow stays; "Später" never pulls something forward.
  if (!task.plannedFor || task.plannedFor <= tomorrow)
    Object.assign(patch, userPlannedFor(task, tomorrow));
  // A date that is due today or already passed would put the task right back on today's list.
  if (task.dueDate && task.dueDate <= day) patch.dueDate = tomorrow;
  return patch;
}
