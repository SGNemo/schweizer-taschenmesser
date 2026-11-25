/** Budgets over their frame in the running month: name and how far over (minor units), for the pile's lines. */
import { currencyOf } from '@/core/money';
import { monthOf } from '@/core/time/dates';
import { t } from '@/strings';
import { loadBudgetRows } from './data';

export interface OverBudget {
  id: string;
  name: string;
  /** How far over the frame, minor units (> 0). */
  overMinor: number;
  currency: string;
}

export async function overBudgets(today: string): Promise<OverBudget[]> {
  const { rows, categories } = await loadBudgetRows(monthOf(today), today, true);
  const name = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  return rows
    .filter((r) => r.status.tone === 'over')
    .map((r) => ({
      id: r.budget.id,
      name: name(r.budget.categoryId),
      overMinor: -r.status.remaining,
      currency: currencyOf(r.budget),
    }));
}
