import { nextOccurrence } from '@/core/recurrence/expand';
import type { Task } from './schema';

type T = Pick<Task, 'done' | 'dueDate' | 'priority' | 'order'> & { createdAt: number };

/** Open before done; then earliest due date (undated last), higher priority, manual order, age. */
export function compareTasks(a: T, b: T): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.order !== b.order) return a.order - b.order;
  return a.createdAt - b.createdAt;
}

export interface TaskGroups<X> {
  top: X[];
  children: Map<string, X[]>;
}

/** Splits tasks into sorted top-level tasks and their subtasks. Orphaned subtasks become top-level. */
export function groupTasks<X extends T & { id: string; parentId?: string }>(
  tasks: X[],
): TaskGroups<X> {
  const ids = new Set(tasks.map((t) => t.id));
  const top: X[] = [];
  const children = new Map<string, X[]>();
  for (const t of tasks) {
    if (t.parentId && ids.has(t.parentId)) {
      const list = children.get(t.parentId) ?? [];
      list.push(t);
      children.set(t.parentId, list);
    } else top.push(t);
  }
  top.sort(compareTasks);
  for (const list of children.values()) list.sort(compareTasks);
  return { top, children };
}

export { dueTone, type DueTone } from '@/core/time/due';

/** The due date of the next instance of a recurring task (after its current due date). */
export function nextDueDate(task: Pick<Task, 'dueDate' | 'recurrence'>): string | undefined {
  return task.dueDate && task.recurrence
    ? nextOccurrence(task.recurrence, task.dueDate, task.dueDate)
    : undefined;
}

/**
 * Id of the next instance: `<first id>:<due date>`. Deterministic, so completing the same
 * task twice (or on two devices) never creates a second copy.
 */
export function nextInstanceId(
  task: Pick<Task, 'dueDate' | 'recurrence'> & { id: string },
): string | undefined {
  const next = nextDueDate(task);
  return next ? `${task.id.split(':')[0]}:${next}` : undefined;
}

/** Tasks that belong in the open views (not "Irgendwann"). */
export const isActionable = (t: Pick<Task, 'someday'>): boolean => !t.someday;
