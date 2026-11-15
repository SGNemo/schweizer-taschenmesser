/**
 * „In den Plan“ for a cancellation deadline (overview card „Kündigungsfristen“): asks the planner for a ToDo
 * „<Abo> kündigen“ (15 minutes, priority 3, the last day as a hard due – the same as the planner source) through the
 * `plan.requested` event, then remembers that deadline on the subscription (`plannedDeadline`), so `plannable.ts`
 * does not offer it a second time. The planner adds the entry and says on which day it landed (with „Rückgängig“).
 * Only offered while the planner is on. Nothing but the title and the date leaves the module.
 */
import { bus } from '@/core/events';
import { t } from '@/strings';
import { CANCEL_MINUTES, CANCEL_PRIORITY } from './plannable';
import { subscriptionRepo } from './repo';

export async function planDeadline(
  sub: { id: string; name: string },
  deadline: string,
): Promise<void> {
  await bus.emit('plan.requested', {
    title: t.subscriptions.planTitle(sub.name),
    durationMin: CANCEL_MINUTES,
    priority: CANCEL_PRIORITY,
    due: { date: deadline, hard: true },
  });
  await subscriptionRepo.update(sub.id, { plannedDeadline: deadline });
}
