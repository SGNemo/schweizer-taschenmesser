/**
 * Cancellation deadlines as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „<Abo> kündigen“, 15 minutes, priority 3, the last day of the notice period (`core/deadline/notice.ts`
 * through `cancelDeadlinesInRange`) as a hard due. Only the next deadline within the planned days, only for
 * active subscriptions that are not cancelled already. No write-back: cancelling stays in this module.
 * Switch: `showInPlan`.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { cancelDeadlinesInRange } from './logic';
import { subscriptionRepo } from './repo';
import { settings } from './settings';

export const CANCEL_MINUTES = 15;
export const CANCEL_PRIORITY = 3;

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.subscriptions', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const subs = (await subscriptionRepo.active().toArray()).filter(
      (s) => s.active && !s.recurrence.until,
    );
    const items: PlannableItem[] = [];
    for (const s of subs) {
      const next = cancelDeadlinesInRange(s, ctx.today, ctx.until)
        .map((d) => d.deadline)
        .sort()[0];
      if (!next) continue;
      items.push({
        // The deadline is part of the id: the next period is a new thing to plan.
        id: `${s.id}:${next}`,
        kind: 'cancel',
        title: t.subscriptions.planTitle(s.name),
        to: `/subscriptions?open=${encodeURIComponent(s.id)}`,
        durationMin: CANCEL_MINUTES,
        priority: CANCEL_PRIORITY,
        due: { date: next, hard: true },
        createdAt: s.createdAt,
      });
    }
    return items;
  },
};

export default source;
