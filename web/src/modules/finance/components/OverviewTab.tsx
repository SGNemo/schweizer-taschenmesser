import { lazy, Suspense, useState, type ReactNode } from 'react';
import { formatMoney } from '@/core/money';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import { expensesByCategory, monthSummary, monthlyTrend } from '../logic';
import type { FinanceData } from '../types';
import { totalBalance, useAvailability } from '../summary';
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
  const balance = totalBalance(data);
  const a = useAvailability(balance);
  const sum = monthSummary(data.txs, month);
  const byCategory = expensesByCategory(data.txs, month, data.categories);
  const trend = monthlyTrend(data.txs, month, 6);
  const deducting = a?.deducting;

  return (
    <>
      {a ? (
        <section
          className={styles.hero}
          aria-label={deducting ? t.finance.available : t.finance.balance}
        >
          <div className={styles.heroLabel}>
            {deducting ? t.finance.available : t.finance.balance}
          </div>
          <div
            className={`${styles.heroValue} ${(deducting ? a.available : a.balance) < 0 ? styles.negative : ''}`}
            data-testid="hero"
          >
            {formatMoney(deducting ? a.available : a.balance)}
          </div>
          {deducting ? (
            <div className={styles.heroNote} data-testid="hero-breakdown">
              {t.finance.breakdown(
                formatMoney(a.balance),
                a.useInvoices && a.openInvoices ? formatMoney(a.openInvoices) : '',
                a.useSubs && a.subscriptions ? formatMoney(a.subscriptions) : '',
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.kpis}>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.income}</span>
          <span className={`${styles.kpiValue} ${styles.income}`} data-testid="kpi-income">
            {formatMoney(sum.income)}
          </span>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.expense}</span>
          <span className={styles.kpiValue} data-testid="kpi-expense">
            {formatMoney(sum.expense)}
          </span>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.net}</span>
          <span
            className={`${styles.kpiValue} ${sum.net < 0 ? styles.negative : ''}`}
            data-testid="kpi-net"
          >
            {formatMoney(sum.net)}
          </span>
        </Card>
      </div>

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
