/**
 * Open invoices as a part of the planner's „Finanzen checken“ (planner hub 2, package 2, CONCEPT-ROWS idea 2): the same
 * invoices this module hands the plan (`plannable.ts`: due in the planned days or late, `showInPlan`), named by key
 * only. No amount, no payee leaves here; the planner folds the rows and counts them.
 */
import type { PileSource } from '@/core/modules/types';
import { t } from '@/strings';
import plannable from './plannable';

/** The jump into the open invoices (`?view=open`, read once by the page and taken off the URL). */
export const OPEN_ROUTE = '/invoices?view=open';

const source: PileSource = async (ctx) => {
  const items = await plannable.list(ctx);
  return [
    {
      area: 'money',
      id: 'open',
      count: 0,
      label: t.planner.pile.invoices,
      head: t.planner.pile.head.invoices,
      to: OPEN_ROUTE,
      members: items.map((i) => `invoices:${i.id}`),
    },
  ];
};

export default source;
