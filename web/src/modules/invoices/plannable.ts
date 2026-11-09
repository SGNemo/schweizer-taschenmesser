/**
 * Open invoices as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „<Empfänger> bezahlen“, 10 minutes, priority 2, due date = hard (it must be paid by then). Only invoices
 * due within the planned days (or overdue) are listed. No write-back: paying is a money action and stays
 * in this module (no `onDone`, no `onAssign`); a paid invoice simply leaves the list. Switch: `showInPlan`.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { invoiceRepo } from './repo';
import { settings } from './settings';

export const PAY_MINUTES = 10;
export const PAY_PRIORITY = 2;

/**
 * „Mahnung · 92,40 € bis 13.10.“: a noted payment reminder as the plan row's detail line (the title stays
 * „<Empfänger> bezahlen“, so the planner head's next step reads plainly). The new amount and deadline come
 * only from the note line the reminder wrote (matched by its own prefix, so the person's own note text never
 * appears); amount and due date of the invoice stay. Written in another language: just „Mahnung“.
 */
export function planDetail(i: {
  dunningLevel?: number;
  dunnedAt?: string;
  note?: string;
}): string | undefined {
  if (!i.dunningLevel || !i.dunnedAt) return undefined;
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
    return open.map((i): PlannableItem => ({
      id: i.id,
      kind: 'invoice',
      title: t.invoices.planTitle(i.payee),
      ...detailOf(i),
      to: `/invoices?open=${encodeURIComponent(i.id)}`,
      durationMin: PAY_MINUTES,
      priority: PAY_PRIORITY,
      due: { date: i.dueDate, hard: true },
      createdAt: i.createdAt,
    }));
  },
};

export default source;
