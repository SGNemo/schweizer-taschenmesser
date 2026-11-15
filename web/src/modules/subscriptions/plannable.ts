/**
 * Cancellation deadlines as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „<Abo> kündigen“, 15 minutes, priority 3, the last day of the notice period (`core/deadline/notice.ts`
 * through `cancelDeadlinesInRange`) as a hard due. Since planner hub S2 (docs/design/planner-hub/CONCEPT-SOURCES.md
 * §3.2 row 4) the end of a trial („<Abo>: Probezeit endet“, its last day = the last day to cancel) is a deadline
 * too, and a deadline that has just passed (`missedDeadline`, the module's own „verpasst“, and a trial end, each for
 * `MISSED_RECENT_DAYS`) is still handed over with its date in the past, so the planner can say „Frist vorbei“
 * (P86). Only the NEXT of these per subscription, only for active subscriptions that are not cancelled already.
 * No write-back: cancelling stays in this module – the row gets `action` „Kündigen …“ instead, a route that opens
 * the subscription (CONCEPT-LINKS §2 L7; the page treats `?do=cancel` as untrusted and writes nothing).
 * Switch: `showInPlan`.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import { cancelDeadlinesInRange, missedDeadline, MISSED_RECENT_DAYS } from './logic';
import { subscriptionRepo } from './repo';
import { settings } from './settings';

export const CANCEL_MINUTES = 15;
export const CANCEL_PRIORITY = 3;

/** The route of the plan row's „Kündigen …“: opens the subscription; the page reads `do` as untrusted. */
export const cancelRoute = (id: string): string =>
  `/subscriptions?open=${encodeURIComponent(id)}&do=cancel`;

type Deadline = { date: string; trial: boolean };

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.subscriptions', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const subs = (await subscriptionRepo.active().toArray()).filter(
      (s) => s.active && !s.recurrence.until,
    );
    const items: PlannableItem[] = [];
    for (const s of subs) {
      const candidates: Deadline[] = [];
      // A passed deadline only while it is recent: for quarterly or longer cycles `missedDeadline` has no lower
      // limit, and a months-old row would hide the next real deadline (a trial end, say).
      const recent = addDaysStr(ctx.today, -MISSED_RECENT_DAYS);
      const missed = missedDeadline(s, ctx.today);
      if (missed && missed.deadline >= recent)
        candidates.push({ date: missed.deadline, trial: false });
      const next = cancelDeadlinesInRange(s, ctx.today, ctx.until)
        .map((d) => d.deadline)
        .sort()[0];
      if (next) candidates.push({ date: next, trial: false });
      const trial = s.trialEndsOn;
      if (trial && trial <= ctx.until && trial >= recent)
        candidates.push({ date: trial, trial: true });
      // One row per subscription: the earliest (a passed deadline first – it is the one at stake).
      const first = candidates.sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!first) continue;
      items.push({
        // The deadline is part of the id: the next period is a new thing to plan.
        id: first.trial ? `${s.id}:trial:${first.date}` : `${s.id}:${first.date}`,
        kind: 'cancel',
        title: first.trial
          ? t.subscriptions.planTrialTitle(s.name)
          : t.subscriptions.planTitle(s.name),
        to: `/subscriptions?open=${encodeURIComponent(s.id)}`,
        durationMin: CANCEL_MINUTES,
        priority: CANCEL_PRIORITY,
        // A passed deadline keeps its date: the planner reads it as „Frist vorbei“, it is never moved forward.
        due: { date: first.date, hard: true },
        action: { label: t.subscriptions.planAction, to: cancelRoute(s.id) },
        createdAt: s.createdAt,
      });
    }
    return items;
  },
};

export default source;
