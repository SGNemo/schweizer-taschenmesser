/**
 * The module's first own cancel step (planner hub 2, package 4b; CONCEPT-ROWS idea 4, row Abos), for one deadline:
 *
 *  - „Gekündigt am …“ → a day (default today) → „Vermerken“: writes `cancelledOn` and `recurrence.until` – the last day
 *    before the charge the deadline was for (a trial: its last day). From then on every reader treats the
 *    subscription as cancelled „zum“ that day, so the deadline leaves the plan and the reminders.
 *  - „Läuft weiter“: this one deadline is decided (`keptDeadline`); the next period's deadline comes as usual.
 *
 * Each is one write with the module's own undo toast (COPY X11). The ids a plan row carries (`<id>:<date>`,
 * `<id>:trial:<date>`) are untrusted: anything else reads as no deadline.
 */
import type { Stored } from '@/core/db/types';
import { addDaysStr } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { cancelDeadlinesInRange, nextCancelDeadline } from './logic';
import { subscriptionRepo } from './repo';
import type { Subscription } from './schema';

/** One deadline of a subscription: the last day to cancel, and whether it is the end of a trial. */
export interface Deadline {
  date: string;
  trial: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A plan row's id read back: `<subscription id>` and the deadline; `undefined` for anything else. */
export function parseRowId(id: string): { subId: string; deadline: Deadline } | undefined {
  const trial = /^(.+):trial:(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (trial) return { subId: trial[1]!, deadline: { date: trial[2]!, trial: true } };
  const plain = /^(.+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (plain && DAY.test(plain[2]!))
    return { subId: plain[1]!, deadline: { date: plain[2]!, trial: false } };
  return undefined;
}

/** The deadline the page's step speaks of: the next one (a trial end first when it is earlier). */
export function nextDeadline(s: Subscription, today: string): Deadline | undefined {
  const next = nextCancelDeadline(s, today)?.deadline;
  const trial = s.trialEndsOn && s.trialEndsOn >= today ? s.trialEndsOn : undefined;
  if (trial && (!next || trial <= next)) return { date: trial, trial: true };
  return next ? { date: next, trial: false } : undefined;
}

/** The last day the subscription runs when cancelled by `deadline`: the day before that charge (a trial: its end). */
export function lastDay(s: Subscription, deadline: Deadline): string {
  if (deadline.trial) return deadline.date;
  const charge = cancelDeadlinesInRange(s, deadline.date, deadline.date).find(
    (d) => d.deadline === deadline.date,
  )?.charge;
  return charge ? addDaysStr(charge, -1) : deadline.date;
}

/** „Gekündigt am …“ → „Vermerken“: the day he cancelled, and the subscription ends before that deadline's charge. */
export function markCancelled(
  s: Stored<Subscription>,
  deadline: Deadline,
  on: string,
): Promise<void> {
  return changeWithUndo(async () => {
    await subscriptionRepo.update(s.id, {
      cancelledOn: on,
      recurrence: { ...s.recurrence, until: lastDay(s, deadline), count: undefined },
    });
  }, t.subscriptions.cancelStep.noted);
}

/** „Läuft weiter“: this deadline is decided; the next period's comes as usual. */
export function keepRunning(s: Stored<Subscription>, deadline: Deadline): Promise<void> {
  return changeWithUndo(async () => {
    await subscriptionRepo.update(s.id, { keptDeadline: deadline.date });
  }, t.subscriptions.cancelStep.kept);
}
