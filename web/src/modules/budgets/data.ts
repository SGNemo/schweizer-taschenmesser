import { useLiveQuery } from 'dexie-react-hooks';
import { useModuleStates } from '@/core/modules/activation';
// Sanctioned cross-module read access (see CLAUDE.md): finance/public only.
import { expensesByCategory, listExpenseCategories } from '@/modules/finance/public';
import { budgetRepo } from './repo';

/** Budgets with the month's spending. `financeOn` is false while the finance module is disabled. */
export function useBudgetData(month: string) {
  const states = useModuleStates();
  const financeOn = states?.finance;
  const data = useLiveQuery(async () => {
    const budgets = await budgetRepo.active().toArray();
    if (!financeOn) return { budgets, categories: [], spent: new Map<string, number>() };
    const [categories, spent] = await Promise.all([
      listExpenseCategories(),
      expensesByCategory(month),
    ]);
    return { budgets, categories, spent };
  }, [financeOn, month]);
  return { data, financeOn, loading: states === undefined };
}
