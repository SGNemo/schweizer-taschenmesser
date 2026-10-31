import { currencyOf, formatMoney } from '@/core/money';
import type { AttentionSource } from '@/core/modules/types';
import { monthOf } from '@/core/time/dates';
import { t } from '@/strings';
// Sanctioned cross-module read access (see CLAUDE.md): finance/public only.
import { expensesByCategory, listExpenseCategories } from '@/modules/finance/public';
import { spentOf, type SpentByCurrency } from './data';
import { budgetStatus } from './logic';
import { budgetRepo } from './repo';

/** Budgets over their monthly limit (danger). Needs the finance module for the spending. */
const source: AttentionSource = async ({ today }) => {
  const budgets = await budgetRepo.active().toArray();
  if (budgets.length === 0) return [];
  const currencies = [...new Set(budgets.map((b) => currencyOf(b)))];
  const [categories, sums] = await Promise.all([
    listExpenseCategories(),
    Promise.all(currencies.map((c) => expensesByCategory(monthOf(today), c))),
  ]);
  const spent: SpentByCurrency = new Map(currencies.map((c, i) => [c, sums[i]!]));
  return budgets.flatMap((b) => {
    const s = budgetStatus(b.monthlyLimitMinor, spentOf(spent, b));
    if (s.tone !== 'over') return [];
    const name = categories.find((c) => c.id === b.categoryId)?.name ?? t.budgets.unknownCategory;
    return [
      {
        id: `budgets:over:${b.id}`,
        tone: 'danger' as const,
        icon: 'piggy' as const,
        title: t.attention.budgetOver(name),
        detail: t.budgets.over(formatMoney(-s.remaining, currencyOf(b))),
        to: '/budgets',
        rank: 4,
      },
    ];
  });
};

export default source;
