import { lazy, Suspense, useState, type ReactNode } from 'react';
import { formatMoney } from '@/core/money';
import { useCurrency } from '../currency';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import { monthSummary, monthlyTrend } from '../logic';
import { compareMonths, topCategoryTotals, type Delta } from '../analysis';
import { ForecastCard } from './ForecastCard';
import type { FinanceData } from '../types';
import { totalBalance, useAvailability } from '../summary';
import { monthBalanceSeries } from '../balanceSeries';
import { CategoryRing } from './CategoryRing';
import { MonthCurve } from './MonthCurve';
import { today } from '@/core/time/dates';
import styles from '../routes/finance.module.css';

// Recharts is heavy: load it only when the overview is shown.
const Charts = lazy(() => import('./Charts').then((m) => ({ default: m.CategoryBars })));
const Trend = lazy(() => import('./Charts').then((m) => ({ default: m.TrendColumns })));
const CategoryTable = lazy(() => import('./Charts').then((m) => ({ default: m.CategoryTable })));
const TrendTable = lazy(() => import('./Charts').then((m) => ({ default: m.TrendTable })));

function ChartCard({ title, chart, table }: { title: string; chart: ReactNode; table: ReactNode }) {
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
      <Suspense fallback={<p role="status">…</p>}>{asTable ? table : chart}</Suspense>
    </Card>
  );
}

/** "▲ 120,00 € (+8 %) zum Vormonat": arrow and sign as text, no colour of its own (more spending is not "bad" by itself). */
function DeltaLine({ d, money }: { d: Delta; money: (m: number) => string }) {
  const text =
    d.diffMinor === 0
      ? t.finance.ext.compare.unchanged
      : t.finance.ext.compare.vsPrevious(
          `${d.diffMinor > 0 ? '▲ +' : '▼ −'}${money(Math.abs(d.diffMinor))}${
            d.percent === undefined ? '' : ` (${d.percent > 0 ? '+' : ''}${d.percent} %)`
          }`,
        );
  return <span className={styles.delta}>{text}</span>;
}

/** `narrow`: the overview shares the row with a side panel, so the charts stay in one column. */
export function OverviewTab({
  data,
  month,
  narrow = false,
}: {
  data: FinanceData;
  month: string;
  narrow?: boolean;
}) {
  const currency = useCurrency();
  const money = (minor: number) => formatMoney(minor, currency);
  const balance = totalBalance(data);
  const a = useAvailability(balance, currency);
  const sum = monthSummary(data.txs, month);
  const byCategory = topCategoryTotals(data.txs, month, data.categories);
  const cmp = compareMonths(data.txs, month);
  const hasPrevious = data.txs.some((x) => x.date.slice(0, 7) < month);
  const trend = monthlyTrend(data.txs, month, 6);
  const curve = monthBalanceSeries(data.accounts, data.txs, month, today());

  return (
    <>
      {/* The head carries the one large figure ("Verfügbar"); this line says what it is made of, once. */}
      {a?.deducting ? (
        <p className={styles.breakdown} data-testid="hero-breakdown">
          {t.finance.breakdown(
            money(a.balance),
            a.useInvoices && a.openInvoices ? money(a.openInvoices) : '',
            a.useSubs && a.subscriptions ? money(a.subscriptions) : '',
          )}
        </p>
      ) : null}

      <div className={styles.kpis}>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.income}</span>
          <span className={`${styles.kpiValue} ${styles.income}`} data-testid="kpi-income">
            {money(sum.income)}
          </span>
          {hasPrevious ? <DeltaLine d={cmp.income} money={money} /> : null}
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.expense}</span>
          <span className={styles.kpiValue} data-testid="kpi-expense">
            {money(sum.expense)}
          </span>
          {hasPrevious ? <DeltaLine d={cmp.expense} money={money} /> : null}
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.net}</span>
          <span
            className={`${styles.kpiValue} ${sum.net < 0 ? styles.negative : ''}`}
            data-testid="kpi-net"
          >
            {money(sum.net)}
          </span>
          {hasPrevious ? <DeltaLine d={cmp.net} money={money} /> : null}
        </Card>
      </div>

      <div className={`${styles.visuals} ${narrow ? styles.visualsOne : ''}`}>
        <MonthCurve points={curve} />
        <CategoryRing rows={byCategory} />
      </div>

      <ForecastCard data={data} />

      <div className={`${styles.charts} ${narrow ? styles.chartsOne : ''}`}>
        <ChartCard
          title={t.finance.expensesByCategory}
          chart={
            byCategory.length ? (
              <Charts rows={byCategory} />
            ) : (
              <p className={styles.empty}>{t.finance.noExpenses}</p>
            )
          }
          table={
            byCategory.length ? (
              <CategoryTable rows={byCategory} />
            ) : (
              <p className={styles.empty}>{t.finance.noExpenses}</p>
            )
          }
        />
        <ChartCard
          title={t.finance.trend}
          chart={<Trend points={trend} />}
          table={<TrendTable points={trend} />}
        />
      </div>
    </>
  );
}
