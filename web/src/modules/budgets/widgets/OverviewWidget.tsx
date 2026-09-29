import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '@/core/money';
import { monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { useBudgetData } from '../data';
import { budgetStatus, goalProgress } from '../logic';
import { depositRepo, goalRepo } from '../repo';

export default function OverviewWidget() {
  const day = today();
  const { data } = useBudgetData(monthOf(day));
  const goals = useLiveQuery(() => goalRepo.active().toArray(), []);
  const deposits = useLiveQuery(() => depositRepo.active().toArray(), []);
  if (!data || !goals || !deposits) return <p role="status">…</p>;

  const name = (id: string) =>
    data.categories.find((c) => c.id === id)?.name ?? t.budgets.unknownCategory;
  const budgetEntries = data.budgets
    .map((b) => ({ b, s: budgetStatus(b.monthlyLimitMinor, data.spent.get(b.categoryId) ?? 0) }))
    .filter((x) => x.s.tone !== 'ok')
    .map(({ b, s }) => ({
      key: `b-${b.id}`,
      title: name(b.categoryId),
      meta: s.tone === 'over' ? t.budgets.over(formatMoney(-s.remaining)) : `${s.pct} %`,
      overdue: s.tone === 'over',
    }));
  const goalEntries = goals.slice(0, 3).map((g) => {
    const p = goalProgress(
      g,
      deposits.filter((d) => d.goalId === g.id),
      day,
    );
    return { key: `g-${g.id}`, title: g.name, meta: `${p.pct} %` };
  });
  return (
    <WidgetList
      loading={false}
      empty={budgetEntries.length + goalEntries.length === 0 ? t.budgets.widgetEmpty : undefined}
      entries={[...budgetEntries, ...goalEntries]}
      to="/budgets"
      linkLabel={t.budgets.title}
    />
  );
}
