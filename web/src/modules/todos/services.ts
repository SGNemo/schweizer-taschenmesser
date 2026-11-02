import { bus } from '@/core/events';
import { t } from '@/strings';
import { ensureInbox, listRepo, taskRepo } from './repo';

/** Adds a requested to-do to the inbox (the first list when there is no inbox). */
export async function addRequested(req: { title: string; note?: string }): Promise<void> {
  const title = req.title.trim();
  if (!title) return;
  await ensureInbox(t.todos.inbox);
  const list = (await listRepo.active().sortBy('order'))[0];
  if (!list) return;
  await taskRepo.create({
    listId: list.id,
    title,
    done: false,
    priority: 0,
    order: 0,
    ...(req.note?.trim() ? { note: req.note.trim() } : {}),
  });
}

/** Runs while the todos module is enabled: reacts to `todo.requested` (e.g. from a note). */
export default function start(): () => void {
  return bus.on('todo.requested', (req) => addRequested(req));
}
