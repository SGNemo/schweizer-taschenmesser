import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { currencyOf, formatMoney } from '@/core/money';
import { useSettings } from '@/core/settings/settings';
import { monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, FortschrittBody, Skeleton, useWidgetSize, WidgetBody } from '@/ui';
import { Spark } from '@/ui/charts';
import { useBudgetData, useBudgetInsights } from '../data';
import styles from './OverviewWidget.module.css';
import { goalProgress } from '../compute';
import { trendValues } from '../insights';
import { settings, settingsSchema } from '../settings';
import { depositRepo, goalRepo } from '../repo';

/** The two budgets that need the most attention (healthy ones too: "75 %" is information), the goals, and "Ausgabe +". */
export default function OverviewWidget() {
  const day = today();
  const month = monthOf(day);
  const { data } = useBudgetData(month);
  const size = useWidgetSize();
  const [prefs] = useSettings(
    'module.budgets',
    settingsSchema,
    settings.defaults as { warnAtPercent: number; showForecast: boolean; showCharts: boolean },
  );
  // The curve only from size m on and while the charts are on (the module setting switches it off too).
  const showTrend = size !== 's' && Boolean(prefs?.showCharts);
  const insights = useBudgetInsights(month, data, showTrend);
  const goals = useLiveQuery(() => goalRepo.active().toArray(), []);
  const deposits = useLiveQuery(() => depositRepo.active().toArray(), []);
  const navigate = useNavigate();
  const trend =
    insights && trendValues(insights.months, insights.spentPerMonth, insights.hasSpending, month);
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
      {/* The `fortschritt` shape as bars (F05): budgets and goals fill in the module hue, an overrun says so in words. */}
      <WidgetBody
        loading={false}
        isEmpty={budgetEntries.length + goalEntries.length === 0}
        empty={t.budgets.widgetEmpty}
        emptyAction={{ label: t.homeEmpty.budgets, to: '/budgets?tab=goals&new=1' }}
      >
        <FortschrittBody
          kind="bars"
          summary={budgetEntries.length > 0 ? t.widgets.budgetsSummary(over.length) : undefined}
          entries={[...budgetEntries, ...goalEntries]}
        />
      </WidgetBody>
      {/* The last six months as a shape (no values to read; the rows above carry the numbers), from size m on. */}
      {showTrend && budgetEntries.length > 0 && trend?.some((v) => v !== null) ? (
        <p className={styles.trend} data-testid="budgets-widget-trend">
          <Spark values={trend} />
          <span>{t.budgets.ext.charts.widgetTrend}</span>
        </p>
      ) : null}
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
