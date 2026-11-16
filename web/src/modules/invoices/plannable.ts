/**
 * Open invoices as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „<Empfänger> bezahlen“, 10 minutes, priority 2 (3 while a reminder is noted), due date = hard (it must be paid
 * by then; a noted reminder's own deadline replaces it: `dunnedDueDate ?? dueDate`). Only invoices due within the
 * planned days (or overdue) are listed. No write-back: paying is a money action and stays in this module (no
 * `onDone`, no `onAssign`) – the row gets `action` „Bezahlt …“ instead, a route to this module's own pay step
 * (docs/design/planner-hub/CONCEPT-LINKS.md §2, L5–L7). A paid invoice simply leaves the list. The links the
 * invoice carries (the mail it came from, the reminder's mail) are handed over for display. Switch: `showInPlan`.
 */
import { notDeleted } from '@/core/db/repo';
import { linkEntries } from '@/core/entitylinks';
import { formatMoney } from '@/core/money';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { invoiceRepo } from './repo';
import type { ReturnFrom } from './returnTo';
import { settings } from './settings';

export const PAY_MINUTES = 10;
export const PAY_PRIORITY = 2;
/** While a reminder is noted the invoice goes first among the things of its day. */
export const DUNNED_PRIORITY = 3;

/**
 * The route of the invoice's own pay step. The page treats every parameter as untrusted and only opens the step;
 * `from` (a key of `returnTo.ts`) lets „Bezahlt“ hand the person back to where they came from.
 */
export const payRoute = (id: string, from?: ReturnFrom): string =>
  `/invoices?open=${encodeURIComponent(id)}&do=pay${from ? `&from=${from}` : ''}`;

/** The day the invoice must be paid by: the noted reminder's deadline, else the invoice's own. */
export const hardDue = (i: { dueDate: string; dunnedDueDate?: string }): string =>
  i.dunnedDueDate ?? i.dueDate;

/**
 * „Mahnung · 92,40 € bis 13.10.“: a noted payment reminder as the plan row's detail line (the title stays
 * „<Empfänger> bezahlen“, so the planner head's next step reads plainly). The new amount and deadline come from
 * the fields the reminder wrote (`dunnedAmountMinor`, `dunnedDueDate`, since version 5) – in the language and
 * format of now. A reminder noted before has only its note line: that line is still read (matched by its own
 * prefix, so the person's own note text never appears; written in another language: just „Mahnung“). Amount and
 * due date of the invoice stay.
 */
export function planDetail(i: {
  dunningLevel?: number;
  dunnedAt?: string;
  dunnedDueDate?: string;
  dunnedAmountMinor?: number;
  currency?: string;
  note?: string;
}): string | undefined {
  if (!i.dunningLevel || !i.dunnedAt) return undefined;
  if (i.dunnedDueDate || i.dunnedAmountMinor) {
    const amount = i.dunnedAmountMinor ? formatMoney(i.dunnedAmountMinor, i.currency) : undefined;
    const until = i.dunnedDueDate ? formatDay(i.dunnedDueDate, 'd. MMM') : undefined;
    return t.invoices.planDunned(
      amount && until
        ? t.invoices.planDunnedUntil(amount, until)
        : (amount ?? t.invoices.planDunnedBy(until!)),
    );
  }
  const prefix = t.quickCapture
    .dunningNote(formatDay(i.dunnedAt, 'dd.MM.yyyy'), '\u0000')
    .split('\u0000')[0]!;
  const last = (i.note ?? '').split('\n').at(-1) ?? '';
  return t.invoices.planDunned(last.startsWith(prefix) ? last.slice(prefix.length) : undefined);
}

const detailOf = (i: Parameters<typeof planDetail>[0]) => {
  const detail = planDetail(i);
  return detail ? { detail } : {};
};

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.invoices', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const open = await invoiceRepo.table
      .where('dueDate')
      .belowOrEqual(ctx.until)
      .filter((i) => notDeleted(i) && i.status === 'open')
      .toArray();
    const items: PlannableItem[] = [];
    for (const i of open) {
      // Display only: where the invoice came from and which mail the reminder was (two indexed reads each).
      const links = (await linkEntries({ module: 'invoices', id: i.id }))
        .filter((e) => e.direction === 'out')
        .map(({ link: { to, rel, label, on } }) => ({ to, rel, label, ...(on ? { on } : {}) }));
      items.push({
        id: i.id,
        kind: 'invoice',
        title: t.invoices.planTitle(i.payee),
        ...detailOf(i),
        to: `/invoices?open=${encodeURIComponent(i.id)}`,
        durationMin: PAY_MINUTES,
        priority: i.dunningLevel ? DUNNED_PRIORITY : PAY_PRIORITY,
        // The planner takes the earlier of this and a hard deadline the person set on the plan row.
        due: { date: hardDue(i), hard: true },
        action: { label: t.invoices.planAction, to: payRoute(i.id, 'plan') },
        ...(links.length ? { links } : {}),
        createdAt: i.createdAt,
      });
    }
    return items;
  },
};

export default source;
