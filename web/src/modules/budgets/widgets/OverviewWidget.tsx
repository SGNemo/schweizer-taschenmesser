import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { currencyOf, formatMoney } from '@/core/money';
import { monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, ProgressList, Skeleton, useWidgetSize } from '@/ui';
import { useBudgetData } from '../data';
import { goalProgress } from '../compute';
import { depositRepo, goalRepo } from '../repo';

/** The two budgets that need the most attention (healthy ones too: "75 %" is information), the goals, and "Ausgabe +". */
export default function OverviewWidget() {
  const day = today();
  const { data } = useBudgetData(monthOf(day));
  const goals = useLiveQuery(() => goalRepo.active().toArray(), []);
  const deposits = useLiveQuery(() => depositRepo.active().toArray(), []);
  const navigate = useNavigate();
  const size = useWidgetSize();
  if (!data || !goals || !deposits) return <Skeleton width="60%" height="1.25rem" />;

  const name = (id: string) =>
    data.categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  const ranked = [...data.rows].sort((a, b) => b.status.pct - a.status.pct).slice(0, 2);
  const over = data.rows.filter((r) => r.status.tone === 'over');
  const budgetEntries = ranked.map((r) => ({
    key: `b-${r.budget.id}`,
    title: name(r.budget.categoryId),
    value: r.spent,
    max: r.limit,
    detail: `${r.status.pct} %`,
    overText:
      r.status.tone === 'over'
        ? t.budgets.over(formatMoney(-r.status.remaining, currencyOf(r.budget)))
        : undefined,
  }));
  const goalEntries = goals.map((g) => {
    const p = goalProgress(
      g,
      deposits.filter((d) => d.goalId === g.id),
      day,
    );
    return { key: `g-${g.id}`, title: g.name, value: p.pct, max: 100, detail: `${p.pct} %` };
  });
  return (
    <>
      <ProgressList
        loading={false}
        empty={t.budgets.widgetEmpty}
        emptyAction={{ label: t.homeEmpty.budgets, to: '/budgets?tab=goals&new=1' }}
        summary={budgetEntries.length > 0 ? t.widgets.budgetsSummary(over.length) : undefined}
        entries={[...budgetEntries, ...goalEntries]}
      />
      {/* The one thing done most often next to a budget: an expense (opens finance's booking dialog). */}
      {size !== 's' && budgetEntries.length > 0 ? (
        <Button
          size="sm"
          onClick={() => void navigate('/finance?tab=transactions&new=1')}
          data-testid="widget-add-expense"
        >
          {t.budgets.ext.widget.addExpense}
        </Button>
      ) : null}
    </>
  );
}
