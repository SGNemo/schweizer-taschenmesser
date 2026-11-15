/**
 * Document deadlines as a source of the planner (`contributions.plannable`; planner hub S2,
 * docs/design/planner-hub/CONCEPT-SOURCES.md §3.2 row 5) – the same family as the subscriptions' source:
 * - a document with an end and a notice period → „Vertrag kündigen“ (kind `cancel`), hard due = the last day to
 *   cancel (`cancelDeadline`: the end minus the notice);
 * - a document with an end but no notice period (passport, warranty) → „Ausweis verlängern“ / „Garantie prüfen“ …
 *   (kind `renew`), hard due = the end.
 * 15 minutes; only dates up to the plan's last day. A date that has just passed (within `LATE_DAYS`) is still handed
 * over with its date in the past, so the planner can say „Frist vorbei“ (P86); a cancellation deadline only while
 * the term has not ended. One row per document.
 *
 * PRIVACY: the TITLE is the category's wording only, never the document's name or a file name – plan titles travel
 * into calendar chips, the agenda, the planner widget and its run record (`modules/planner/calendar.ts`), and the
 * overview promises no document titles (`calendar.ts` here). A custom category's name is not used either (the
 * person typed it). The name is `detail` only, which the planner shows on its own page and nowhere else.
 * No write-back: the row gets `action` „Zum Dokument“. Switch: `showInPlan`.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import { isBuiltin } from './categories';
import { cancelDeadline, endOf } from './logic';
import { documentRepo } from './repo';
import { settings } from './settings';

export const DOC_MINUTES = 15;
export const CANCEL_PRIORITY = 3;
export const RENEW_PRIORITY = 2;
/** Days a passed date stays in the plan („Frist vorbei“): long enough to notice, never a permanent row. */
export const LATE_DAYS = 7;

/** The route of „Zum Dokument“: the document's own dialog; the page checks the id. */
export const documentRoute = (id: string): string => `/vault?open=${encodeURIComponent(id)}`;

/** The wording key of a category: a built-in key, else '' (a custom category's name is the person's text). */
const wordingOf = (category: string): string => (isBuiltin(category) ? category : '');

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.vault', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const from = addDaysStr(ctx.today, -LATE_DAYS);
    const inPlan = (d: string | undefined): d is string => !!d && d >= from && d <= ctx.until;
    const items: PlannableItem[] = [];
    for (const d of await documentRepo.active().toArray()) {
      const end = endOf(d);
      if (!end) continue;
      const deadline = cancelDeadline(d);
      const wording = wordingOf(d.category);
      const base = {
        to: documentRoute(d.id),
        durationMin: DOC_MINUTES,
        // Display only, on the planner page: the one place the name may stand.
        detail: d.title,
        action: { label: t.vault.planAction, to: documentRoute(d.id) },
        createdAt: d.createdAt,
      };
      if (deadline !== undefined) {
        // After the end there is nothing left to cancel.
        if (!inPlan(deadline) || end < ctx.today) continue;
        items.push({
          ...base,
          id: `${d.id}:cancel:${deadline}`,
          kind: 'cancel',
          title: t.vault.planCancel(wording),
          priority: CANCEL_PRIORITY,
          due: { date: deadline, hard: true },
        });
      } else if (inPlan(end)) {
        items.push({
          ...base,
          id: `${d.id}:end:${end}`,
          kind: 'renew',
          title: t.vault.planRenew(wording),
          priority: RENEW_PRIORITY,
          due: { date: end, hard: true },
        });
      }
    }
    return items;
  },
};

export default source;
