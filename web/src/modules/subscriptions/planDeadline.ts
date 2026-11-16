/**
 * „In den Plan“ for a cancellation deadline (overview card „Kündigungsfristen“): remembers the deadline on the
 * subscription (`plannedDeadline`), and the planner source (`plannable.ts`) then lists exactly that deadline as
 * „<Abo> kündigen“ – also beyond the planner's horizon and with „Im Plan zeigen“ off, since the person asked for it.
 * The row is the source's own (same id, the link back and „Kündigen …“), so it never doubles one that is listed
 * anyway, and „Rückgängig“ on the toast takes the request back. Offered only while the planner is on.
 */
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { subscriptionRepo } from './repo';

export function planDeadline(sub: { id: string; name: string }, deadline: string): Promise<void> {
  return changeWithUndo(async () => {
    await subscriptionRepo.update(sub.id, { plannedDeadline: deadline });
  }, t.subscriptions.ext.deadlines.plannedToast(sub.name));
}
