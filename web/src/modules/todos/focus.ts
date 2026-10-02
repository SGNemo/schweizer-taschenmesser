import { now } from '@/core/time/now';
import { saveFocusSession } from '@/core/focus/state';
import { startSession } from '@/core/focus/session';
import type { Task } from './schema';

export const focusPath = (taskId: string): string => `/todos/focus/${taskId}`;

/** Minutes for a new focus round: the task's own estimate when it fits, else the setting. */
export const focusMinutesFor = (task: Pick<Task, 'estimateMin'>, defaultMinutes: number): number =>
  task.estimateMin && task.estimateMin >= 5 && task.estimateMin <= 120
    ? task.estimateMin
    : defaultMinutes;

/** Starts a focus round for the task (replacing a running one on this device). */
export async function beginFocus(
  task: { id: string; title: string } & Pick<Task, 'estimateMin'>,
  defaultMinutes: number,
): Promise<void> {
  await saveFocusSession(
    startSession(task, focusMinutesFor(task, defaultMinutes), now(), focusPath(task.id)),
  );
}
