import type { PlannableEntry } from '@/core/modules/contributions';
import { linksOfEntry } from './RowLinks';

/**
 * What a row may carry (package 4c): its first `origin` link. The host decides which targets it mounts above the row's
 * own panel (today a mail thread: mail's panel first, the ToDo's own lines under it); any other origin is ignored.
 */
export function carrierOf(entry: PlannableEntry): { moduleId: string; id: string } | undefined {
  const origin = linksOfEntry(entry).find((l) => l.rel === 'origin');
  return origin ? { moduleId: origin.to.module, id: origin.to.id } : undefined;
}
