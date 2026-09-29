import { t } from '@/strings';
import { ensureInbox, listRepo } from './repo';

/** Tasks created by the assistant land in the first list (the inbox on a fresh install). */
export default async function defaults(collection: string): Promise<Record<string, unknown>> {
  if (collection !== 'task') return {};
  await ensureInbox(t.todos.inbox);
  const first = (await listRepo.active().sortBy('order'))[0];
  return first ? { listId: first.id } : {};
}
