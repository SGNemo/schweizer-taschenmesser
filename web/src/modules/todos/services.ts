import { liveQuery } from 'dexie';
import { bus } from '@/core/events';
import { logError } from '@/core/diagnostics/logError';
import { getMeta } from '@/core/db/metaKv';
import { loadStoredModuleState } from '@/core/modules/activation';
import { PULL_COMPLETE_KEY } from '@/core/storage/dexie';
import { LAST_SYNC_KEY } from '@/core/sync/service';
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

/** What the clean-up depends on: the planner's stored state, the sync gate, the marks themselves. */
async function cleanupInputs(): Promise<string> {
  const [stored, pull, lastSync, marked] = await Promise.all([
    loadStoredModuleState(PLANNER_ID),
    getMeta(PULL_COMPLETE_KEY),
    getMeta(LAST_SYNC_KEY),
    taskRepo
      .active()
      .filter((x) => x.planMark !== undefined)
      .count(),
  ]);
  return JSON.stringify([stored?.enabled, pull, lastSync, marked]);
}

/**
 * Runs while the todos module is enabled: reacts to `todo.requested` (e.g. from a note) and hands the
 * planner's dates back to the user whenever the stored state says the planner is off and the sync gate
 * is open – also for a mark that lands late (a run in another tab or device, a sync round that ends).
 */
export default function start(): () => void {
  const offRequested = bus.on('todo.requested', (req) => addRequested(req));
  const sub = liveQuery(cleanupInputs).subscribe({
    next: () => void cleanupPlanMarks().catch(logError('todos.planMark')),
    error: (e) => console.error('[todos] plan-mark stream failed', e),
  });
  return () => {
    offRequested();
    sub.unsubscribe();
  };
}
