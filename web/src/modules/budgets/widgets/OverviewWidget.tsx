import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '@/core/money';
import { monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { ProgressList, Skeleton } from '@/ui';
import { useBudgetData } from '../data';
import { budgetStatus, goalProgress } from '../logic';
import { depositRepo, goalRepo } from '../repo';

export default function OverviewWidget() {
  const day = today();
  const { data } = useBudgetData(monthOf(day));
  const goals = useLiveQuery(() => goalRepo.active().toArray(), []);
  const deposits = useLiveQuery(() => depositRepo.active().toArray(), []);
  if (!data || !goals || !deposits) return <Skeleton width="60%" height="1.25rem" />;

  const name = (id: string) =>
    data.categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  const budgets = data.budgets
    .map((b) => ({ b, s: budgetStatus(b.monthlyLimitMinor, data.spent.get(b.categoryId) ?? 0) }))
    .filter((x) => x.s.tone !== 'ok');
  const over = budgets.filter((x) => x.s.tone === 'over');
  const budgetEntries = [...over, ...budgets.filter((x) => x.s.tone !== 'over')].map(
    ({ b, s }) => ({
      key: `b-${b.id}`,
      title: name(b.categoryId),
      value: data.spent.get(b.categoryId) ?? 0,
      max: b.monthlyLimitMinor,
      detail: `${s.pct} %`,
      overText: s.tone === 'over' ? t.budgets.over(formatMoney(-s.remaining)) : undefined,
    }),
  );
  const goalEntries = goals.map((g) => {
    const p = goalProgress(
      g,
      deposits.filter((d) => d.goalId === g.id),
      day,
    );
    return {
      key: `g-${g.id}`,
      title: g.name,
      value: p.pct,
      max: 100,
      detail: `${p.pct} %`,
    };
  });
  const entries = [...budgetEntries, ...goalEntries];
  return (
    <ProgressList
      loading={false}
      empty={t.budgets.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.budgets, to: '/budgets?tab=goals&new=1' }}
      summary={budgetEntries.length > 0 ? t.widgets.budgetsSummary(over.length) : undefined}
      entries={entries}
    />
  );
}
