import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { Stored } from '@/core/db/types';
import { addDaysStr, daysBetween } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { nextDueDate, nextInstanceId } from './logic';
import { listSchema, taskSchema, type Task } from './schema';

export const listRepo = createRepo(tableName('todos', 'list'), listSchema);
export const taskRepo = createRepo(tableName('todos', 'task'), taskSchema);

export const INBOX_ID = 'inbox';

/** Makes sure at least one list exists. The fixed id lets several devices converge on one inbox. */
export async function ensureInbox(name: string): Promise<void> {
  if ((await listRepo.active().count()) > 0) return;
  const existing = await listRepo.table.get(INBOX_ID);
  if (existing) {
    await listRepo.restore(INBOX_ID);
    return;
  }
  await listRepo.create({ name, order: 0 }, { id: INBOX_ID });
}

/** Deletes a list together with all its tasks (tombstones). */
export async function deleteList(listId: string): Promise<void> {
  const ids = (await taskRepo.table.where('listId').equals(listId).toArray())
    .filter((t) => t.deletedAt === null)
    .map((t) => t.id);
  await taskRepo.removeMany(ids);
  await listRepo.remove(listId);
}

/** Deletes a task and its subtasks. */
export async function deleteTask(taskId: string): Promise<void> {
  const subs = (await taskRepo.table.where('parentId').equals(taskId).toArray())
    .filter((t) => t.deletedAt === null)
    .map((t) => t.id);
  await taskRepo.removeMany([taskId, ...subs]);
}

/**
 * Ticks a task off or reopens it. Ticking off a recurring task keeps it (as history) and creates
 * the next instance with a deterministic id, together with copies of its subtasks (open again,
 * due dates moved by the same number of days); reopening removes that instance again while it is
 * still open.
 */
export async function setDone(task: Stored<Task>, done: boolean): Promise<void> {
  await taskRepo.update(task.id, { done, completedAt: done ? now() : undefined });
  const nextId = nextInstanceId(task);
  const nextDue = nextDueDate(task);
  if (!nextId || !nextDue) return;
  if (done) {
    const shift = daysBetween(task.dueDate!, nextDue);
    const subs = (await taskRepo.table.where('parentId').equals(task.id).toArray()).filter(
      (s) => s.deletedAt === null,
    );
    await taskRepo.createMany([
      {
        id: nextId,
        data: {
          listId: task.listId,
          title: task.title,
          done: false,
          priority: task.priority,
          dueDate: nextDue,
          recurrence: task.recurrence,
          estimateMin: task.estimateMin,
          note: task.note,
          order: task.order,
        },
      },
      ...subs.map((s) => ({
        // Same rule as the parent: `<first id>:<date>`, so a second run adds nothing.
        id: `${s.id.split(':')[0]}:${nextDue}`,
        data: {
          listId: s.listId,
          parentId: nextId,
          title: s.title,
          done: false,
          priority: s.priority,
          ...(s.dueDate ? { dueDate: addDaysStr(s.dueDate, shift) } : {}),
          note: s.note,
          order: s.order,
        },
      })),
    ]);
  } else {
    const next = await taskRepo.get(nextId);
    if (next && !next.done) await deleteTask(nextId);
  }
}
