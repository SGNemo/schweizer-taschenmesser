import { useState } from 'react';
import { formatMoney, formatMoneyAxis } from '@/core/money';
import { dateTimeFormat } from '@/core/i18n/format';
import { formatDay, formatMonth, parseDate } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Card, SensitiveValue } from '@/ui';
import { Donut, Trend } from '@/ui/charts';
import { useCurrency } from '../currency';
import type { CategoryTotal, MonthPoint as IncomePoint } from '../logic';
import { changeOver, type MonthPoint as WorthPoint } from '../netWorth';
import styles from '../routes/finance.module.css';

/**
 * The finance charts, all drawn by the shared blocks of `@/ui/charts` (round "Tiefe & Politur", p2): one chart per
 * question, money as `formatMoney` in the shown currency, every one `sensitive` ("Werte ausblenden" masks every
 * amount, the shapes stay). The blocks carry the screen-reader summary and table; the card carries the heading.
 */
/** Short day labels in the app's date format: "5." / "5" alone, "3.10." / "10/3" across months. */
const dayFormat = (dayOnly: boolean) =>
  dateTimeFormat(dayOnly ? { day: 'numeric' } : { day: 'numeric', month: 'numeric' });

function useMoney() {
  const currency = useCurrency();
  return (minor: number) => formatMoney(minor, currency);
}

/**
 * A balance by day ("Verlauf im Monat", the outlook's curve): one line, labels thinned by the block. Inside one month
 * the day is enough ("1." … "30.", the month switch names the month); the outlook can cross months ("3.10.").
 */
export function DayBalanceChart({
  points,
  title,
  testId,
  dayOnly = false,
}: {
  points: readonly { date: string; balanceMinor: number }[];
  title: string;
  testId: string;
  dayOnly?: boolean;
}) {
  const money = useMoney();
  return (
    <Trend
      title={title}
      labels={points.map((p) => dayFormat(dayOnly).format(parseDate(p.date)))}
      series={[
        { id: 'balance', label: t.finance.balance, values: points.map((p) => p.balanceMinor) },
      ]}
      format={money}
      formatAxis={formatMoneyAxis}
      sensitive
      data-testid={testId}
    />
  );
}

/** Where the month's (or year's) money went: the donut names every category with its amount and share. */
export function CategoryDonut({
  rows,
  title,
  testId = 'chart-categories',
}: {
  rows: readonly CategoryTotal[];
  title: string;
  testId?: string;
}) {
  const money = useMoney();
  return (
    <Donut
      title={title}
      data={rows.map((r) => ({
        id: r.categoryId ?? `name:${r.name}`,
        label: r.name,
        value: r.amountMinor,
      }))}
      centreLabel={t.finance.expense}
      format={money}
      sensitive
      emptyText={t.finance.noExpenses}
      data-testid={testId}
    />
  );
}

/**
 * Income and expenses per month as two lines (solid and dashed, named in the key with their latest value). `upTo`
 * leaves months after it out (a year that is not over yet does not drop to zero).
 */
export function IncomeExpenseChart({
  points,
  title,
  upTo,
  testId = 'chart-trend',
}: {
  points: readonly IncomePoint[];
  title: string;
  upTo?: string;
  testId?: string;
}) {
  const money = useMoney();
  const known = (p: IncomePoint) => !upTo || p.month <= upTo;
  return (
    <Trend
      title={title}
      labels={points.map((p) => p.label)}
      series={[
        {
          id: 'income',
          label: t.finance.income,
          values: points.map((p) => (known(p) ? p.income : null)),
        },
        {
          id: 'expense',
          label: t.finance.expense,
          values: points.map((p) => (known(p) ? p.expense : null)),
        },
      ]}
      format={money}
      formatAxis={formatMoneyAxis}
      sensitive
      data-testid={testId}
    />
  );
}

/** Table of the months: what the income/expense chart shows, for reading off every value (a visible switch). */
export function MonthTable({ points }: { points: readonly IncomePoint[] }) {
  const money = useMoney();
  return (
    <table className={styles.table} data-testid="table-trend">
      <thead>
        <tr>
          <th scope="col">{t.finance.month_}</th>
          <th scope="col" className={styles.num}>
            {t.finance.income}
          </th>
          <th scope="col" className={styles.num}>
            {t.finance.expense}
          </th>
          <th scope="col" className={styles.num}>
            {t.finance.net}
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.month}>
            <td>{p.label}</td>
            <td className={styles.num}>{money(p.income)}</td>
            <td className={styles.num}>{money(p.expense)}</td>
            <td className={styles.num}>{money(p.net)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A card with a heading and a chart that can be switched to a table of its values. */
export function ChartCard({
  title,
  chart,
  table,
}: {
  title: string;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label={asTable ? t.finance.showChart : t.finance.showTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? t.finance.chartShort : t.finance.tableShort}
        </Button>
      </div>
      {asTable ? table : chart}
    </Card>
  );
}

/**
 * The net worth at each month's end ("Verlauf"). The scale does not start at zero (a small change stays visible); the
 * sentence below names the change since the first month. Today's value is the head's figure, so it is not repeated.
 */
export function NetWorthChart({ points, title }: { points: readonly WorthPoint[]; title: string }) {
  const money = useMoney();
  const change = changeOver([...points]);
  const since = change ? formatMonth(change.since) : '';
  return (
    <Card>
      <h2 className={styles.chartTitle}>{title}</h2>
      <Trend
        title={title}
        labels={points.map((p) => formatDay(`${p.month}-01`, 'MMM yy'))}
        series={[
          {
            id: 'worth',
            label: t.finance.netWorth.widget,
            values: points.map((p) => p.valueMinor),
          },
        ]}
        format={money}
        formatAxis={formatMoneyAxis}
        sensitive
        data-testid="net-worth-chart"
      />
      {change ? (
        <p className={styles.curveFoot} data-testid="net-worth-chart-change">
          {change.diffMinor === 0 ? (
            t.finance.netWorthUnchanged(since)
          ) : (
            <SensitiveValue compact>
              {t.finance.netWorthChange(
                `${change.diffMinor > 0 ? '+' : '−'}${money(Math.abs(change.diffMinor))}`,
                since,
              )}
            </SensitiveValue>
          )}
        </p>
      ) : null}
    </Card>
  );
}
