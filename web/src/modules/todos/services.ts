import { bus } from '@/core/events';
import { logError } from '@/core/diagnostics/logError';
import { t } from '@/strings';
import { cleanupPlanMarks, PLANNER_ID } from './planMark';
import { ensureInbox, listRepo, taskRepo } from './repo';
import type { TaskLink } from './schema';

/** Adds a requested to-do to the inbox (the first list when there is no inbox). */
export async function addRequested(req: {
  title: string;
  note?: string;
  dueDate?: string;
  link?: TaskLink;
}): Promise<void> {
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
    ...(req.dueDate ? { dueDate: req.dueDate } : {}),
    ...(req.link ? { links: [req.link] } : {}),
  });
}

/**
 * Runs while the todos module is enabled: reacts to `todo.requested` (e.g. from a note) and hands the
 * planner's dates back to the user once the planner is switched off (on start and on `module.disabled`).
 */
export default function start(): () => void {
  const clean = () => cleanupPlanMarks().catch(logError('todos.planMark'));
  void clean();
  const offRequested = bus.on('todo.requested', (req) => addRequested(req));
  const offDisabled = bus.on('module.disabled', ({ moduleId }) => {
    if (moduleId === PLANNER_ID) void clean();
  });
  return () => {
    offRequested();
    offDisabled();
  };
}
