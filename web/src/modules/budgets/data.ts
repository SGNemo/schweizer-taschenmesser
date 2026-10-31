import { useLiveQuery } from 'dexie-react-hooks';
import { currencyOf } from '@/core/money';
import { useModuleStates } from '@/core/modules/activation';
// Sanctioned cross-module read access (see CLAUDE.md): finance/public only.
import { expensesByCategory, listExpenseCategories } from '@/modules/finance/public';
import { budgetRepo } from './repo';
import type { Budget } from './schema';

/** Month's spending per currency, then per category id. */
export type SpentByCurrency = Map<string, Map<string, number>>;

/** What was spent in the budget's category and currency (nothing is converted between currencies). */
export const spentOf = (spent: SpentByCurrency, budget: Pick<Budget, 'categoryId' | 'currency'>) =>
  spent.get(currencyOf(budget))?.get(budget.categoryId) ?? 0;

/** Budgets with the month's spending. `financeOn` is false while the finance module is disabled. */
export function useBudgetData(month: string) {
  const states = useModuleStates();
  const financeOn = states?.finance;
  const data = useLiveQuery(async () => {
    const budgets = await budgetRepo.active().toArray();
    if (!financeOn) return { budgets, categories: [], spent: new Map() as SpentByCurrency };
    const currencies = [...new Set(budgets.map((b) => currencyOf(b)))];
    const [categories, sums] = await Promise.all([
      listExpenseCategories(),
      Promise.all(currencies.map((c) => expensesByCategory(month, c))),
    ]);
    const spent: SpentByCurrency = new Map(currencies.map((c, i) => [c, sums[i]!]));
    return { budgets, categories, spent };
  }, [financeOn, month]);
  return { data, financeOn, loading: states === undefined };
}
