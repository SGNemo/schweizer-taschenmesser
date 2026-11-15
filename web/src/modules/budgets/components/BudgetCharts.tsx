import { currencyOf, formatMoney, formatMoneyAxis } from '@/core/money';
import { addMonthsToMonth, formatDay, monthOf, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Card, SensitiveValue } from '@/ui';
import { Bars, Donut, Trend } from '@/ui/charts';
import { mainCurrencyOf, type BudgetData, type BudgetInsights, type BudgetRow } from '../data';
import { dailyRate, headTotals, trendValues } from '../insights';
import { periodOf } from '../period';
import styles from '../routes/budgets.module.css';

/** A figure of the overview: label, amount, and the line that says what the amount means. */
function Figure({
  label,
  value,
  context,
  note,
  testId,
}: {
  label: string;
  value: string;
  context: string;
  /** A second line (calm, never red: a forecast is not an overrun yet). */
  note?: string;
  testId: string;
}) {
  return (
    <div className={styles.figure} data-testid={testId}>
      <span className={styles.figureLabel}>{label}</span>
      <SensitiveValue>
        <span className={styles.figureValue}>{value}</span>
        <span className={styles.note}>{context}</span>
        {note ? <span className={styles.figureNote}>{note}</span> : null}
      </SensitiveValue>
    </div>
  );
}

/** "Lebensmittel" or "Urlaub (Q4 2026)": a bar of a quarter or year budget names its period. */
function barLabel(r: BudgetRow, name: string): string {
  if (r.period === 'quarter')
    return `${name} (${t.budgets.ext.period.quarterLabel(r.info.index, r.info.year)})`;
  if (r.period === 'year') return `${name} (${r.info.year})`;
  return name;
}

/**
 * The budget charts, drawn only with `@/ui/charts`, in two parts so the cards stay near the top on the phone.
 * `head` (above the cards): what is left per day and where the month ends (running month only), spent against
 * limit per budget. `more` (below the cards): the last six months and where all of the month's money went.
 * Speaks in the main currency; budgets in other currencies keep their cards.
 */
export function BudgetCharts({
  part,
  month,
  data,
  rows,
  insights,
  categoryName,
}: {
  part: 'head' | 'more';
  month: string;
  data: BudgetData;
  /** The rows in the page's order (by name). */
  rows: readonly BudgetRow[];
  insights: BudgetInsights | null | undefined;
  categoryName: (id: string) => string;
}) {
  const c = t.budgets.ext.charts;
  const currency = mainCurrencyOf(data.budgets);
  if (!currency) return null;
  const own = rows.filter((r) => currencyOf(r.budget) === currency);
  if (own.length === 0) return null;
  const money = (cents: number) => formatMoney(cents, currency);
  const day = today();
  const info = periodOf(month, 'month');
  const endText = formatDay(info.to, 'd. MMM');
  const head = headTotals(own);
  const rate = head.count > 0 ? dailyRate(head.free, info.from, info.to, day) : undefined;
  const nextMonthText = formatDay(`${addMonthsToMonth(month, 1)}-01`, 'd. MMM');
  const thisMonth = monthOf(day);

  if (part === 'more') {
    if (!insights || insights.currency !== currency || insights.month !== month) return null;
    const spent = trendValues(
      insights.months,
      insights.spentPerMonth,
      insights.hasSpending,
      thisMonth,
    );
    return (
      <section
        className={`${styles.charts} ${styles.chartsMore}`}
        aria-label={c.more}
        data-testid="budget-charts-more"
      >
        <Card title={c.trend}>
          <Trend
            title={c.trend}
            labels={insights.months.map((m) => formatDay(`${m}-01`, 'LLL'))}
            series={[{ id: 'spent', label: c.spent, values: spent }]}
            // The limit is the yardstick, not a second measurement: the grey comparison line.
            compare={{
              id: 'planned',
              label: c.planned,
              values: insights.months.map(() => insights.plannedPerMonth),
            }}
            format={money}
            formatAxis={formatMoneyAxis}
            sensitive
            data-testid="budget-trend"
          />
          <p className={styles.note}>{c.trendContext}</p>
        </Card>
        <Card title={c.donut}>
          <Donut
            title={c.donut}
            data={insights.shares.map((s) => ({
              id: s.id || '__none',
              label: s.id ? categoryName(s.id) : c.uncategorised,
              value: s.value,
            }))}
            centreLabel={c.donutCentre}
            format={money}
            sensitive
            emptyText={c.donutEmpty}
            data-testid="budget-donut"
          />
          {insights.monthTotal > 0 ? (
            <SensitiveValue>
              <p className={styles.note}>
                {c.donutContext(
                  money(insights.monthTotal),
                  money(insights.spentPerMonth[insights.spentPerMonth.length - 1] ?? 0),
                )}
              </p>
            </SensitiveValue>
          ) : null}
        </Card>
      </section>
    );
  }

  const figures = Boolean(rate) || head.projected !== undefined;
  return (
    <section
      // Two columns (figures beside the bars) only when the figures are there: a past month has the bars alone.
      className={`${styles.charts} ${figures ? styles.chartsHead : ''}`}
      aria-label={c.section}
      data-testid="budget-charts"
    >
      {figures ? (
        <Card className={styles.figures}>
          {rate ? (
            head.free > 0 ? (
              <Figure
                label={c.perDay.label}
                value={money(rate.perDay)}
                context={c.perDay.context(money(head.free), rate.daysLeft, endText)}
                testId="budget-per-day"
              />
            ) : (
              <Figure
                label={c.perDay.label}
                value={money(0)}
                context={c.perDay.none}
                testId="budget-per-day"
                note={c.perDay.noneContext(nextMonthText)}
              />
            )
          ) : null}
          {head.projected !== undefined ? (
            <Figure
              label={c.forecast.label}
              value={money(head.projected)}
              context={c.forecast.context(money(head.limit))}
              note={
                head.projected > head.limit
                  ? c.forecast.over(money(head.projected - head.limit))
                  : c.forecast.under(money(head.limit - head.projected))
              }
              testId="budget-forecast"
            />
          ) : null}
        </Card>
      ) : null}
      <Card title={c.bars}>
        <Bars
          className={styles.calmBars}
          title={c.bars}
          data={own.map((r) => ({
            id: r.budget.id,
            label: barLabel(r, categoryName(r.budget.categoryId)),
            value: r.spent,
            target: r.limit,
          }))}
          targetLabel={c.target}
          format={money}
          sensitive
          data-testid="budget-bars"
        />
        <p className={styles.note}>{c.barsContext}</p>
      </Card>
    </section>
  );
}

/** The empty view's example: three made-up limits, so the first budget's look is known before it exists. */
export function ExampleBars() {
  const e = t.budgets.ext.charts.example;
  const money = (cents: number) => formatMoney(cents, 'EUR');
  return (
    <div className={styles.example} data-testid="budgets-example">
      <Bars
        className={styles.calmBars}
        title={e.title}
        showTitle
        data={[
          { id: 'food', label: e.food, value: 31200, target: 40000 },
          { id: 'leisure', label: e.leisure, value: 9000, target: 15000 },
          { id: 'transport', label: e.transport, value: 6400, target: 12000 },
        ]}
        targetLabel={t.budgets.ext.charts.target}
        format={money}
      />
      <p className={styles.note}>{e.caption}</p>
    </div>
  );
}
