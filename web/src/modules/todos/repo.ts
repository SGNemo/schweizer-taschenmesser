import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { listSchema, taskSchema } from './schema';

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
