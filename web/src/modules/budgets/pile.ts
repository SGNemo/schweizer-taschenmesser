/**
 * Budgets over their frame this month as a read-only part of the planner's „Finanzen checken“ (planner hub 2, package
 * 2): a count and a route only. The lines themselves are this module's own `compact` panel (`components/PlanPanel.tsx`,
 * id `over`); no amount ever passes through planner code. Read only: never what keeps the pile, never „done“.
 */
import type { PileSource } from '@/core/modules/types';
import { t } from '@/strings';
import { overBudgets } from './over';

/** The jump into the budgets over their frame (`?view=over`, read once and taken off the URL). */
export const OVER_ROUTE = '/budgets?view=over';
/** The id of this module's `compact` plan panel that draws the lines. */
export const OVER_PANEL = 'over';

const source: PileSource = async ({ today }) => [
  {
    area: 'money',
    id: 'over',
    count: (await overBudgets(today)).length,
    label: t.planner.pile.budgets,
    head: t.planner.pile.head.budgets,
    to: OVER_ROUTE,
    readOnly: true,
    panel: OVER_PANEL,
  },
];

export default source;
