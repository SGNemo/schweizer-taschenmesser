/**
 * Open invoices as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „<Empfänger> bezahlen“, 10 minutes, priority 2, due date = hard (it must be paid by then). Only invoices
 * due within the planned days (or overdue) are listed. No write-back: paying is a money action and stays
 * in this module (no `onDone`, no `onAssign`); a paid invoice simply leaves the list. Switch: `showInPlan`.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { invoiceRepo } from './repo';
import { settings } from './settings';

export const PAY_MINUTES = 10;
export const PAY_PRIORITY = 2;

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
      to: `/invoices?open=${encodeURIComponent(i.id)}`,
      durationMin: PAY_MINUTES,
      priority: PAY_PRIORITY,
      due: { date: i.dueDate, hard: true },
      createdAt: i.createdAt,
    }));
  },
};

export default source;
