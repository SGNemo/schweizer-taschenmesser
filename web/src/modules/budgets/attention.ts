import { currencyOf, formatMoney } from '@/core/money';
import type { AttentionSource } from '@/core/modules/types';

type Items = Awaited<ReturnType<AttentionSource>>;
import { monthOf } from '@/core/time/dates';
import { t } from '@/strings';
import { loadBudgetRows } from './data';

/**
 * Budgets over their limit (danger) and, calmer, budgets that reached their warning threshold
 * (accent: information, not an alarm). Needs the finance module for the spending.
 */
const source: AttentionSource = async ({ today }) => {
  const { rows, categories } = await loadBudgetRows(monthOf(today), today, true);
  const name = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  return rows.flatMap((r): Items => {
    const b = r.budget;
    if (r.status.tone === 'over')
      return [
        {
          id: `budgets:over:${b.id}`,
          tone: 'danger' as const,
          icon: 'piggy' as const,
          title: t.attention.budgetOver(name(b.categoryId)),
          detail: t.budgets.over(formatMoney(-r.status.remaining, currencyOf(b))),
          to: '/budgets',
          rank: 4,
        },
      ];
    // The running period only: a warning about a period that is over is no news.
    if (r.status.tone === 'warn' && r.running)
      return [
        {
          id: `budgets:warn:${b.id}`,
          tone: 'accent' as const,
          icon: 'piggy' as const,
          title: t.budgets.ext.warn.title(name(b.categoryId), r.status.pct),
          detail: t.budgets.left(formatMoney(r.status.remaining, currencyOf(b))),
          to: '/budgets',
          rank: 5,
        },
      ];
    return [];
  });
};

export default source;
