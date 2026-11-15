import { formatMoney } from '@/core/money';
import { formatDay, monthOf } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Card } from '@/ui';
import { rollupYear, yearSummary } from '../analysis';
import { useCurrency } from '../currency';
import type { FinanceData } from '../types';
import { CategoryDonut, IncomeExpenseChart } from './MoneyCharts';
import styles from '../routes/finance.module.css';

/** The year as a table: income, expenses and result per month (numbers right-aligned), the savings rate, where the money went. */
export function YearView({ data, year }: { data: FinanceData; year: number }) {
  const currency = useCurrency();
  const money = (m: number) => formatMoney(m, currency);
  const sum = yearSummary(data.txs, year);
  // Every category: the donut folds the small ones itself.
  const top = rollupYear(data.txs, year, data.categories);
  const name = (id: string | undefined) =>
    (id && data.categories.find((c) => c.id === id)?.name) || t.finance.noCategory;
  const e = t.finance.ext.year;
  return (
    <>
      <div className={styles.kpis}>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.income}</span>
          <span className={styles.kpiValue} data-testid="year-income">
            {money(sum.income)}
          </span>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.expense}</span>
          <span className={styles.kpiValue} data-testid="year-expense">
            {money(sum.expense)}
          </span>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>{t.finance.net}</span>
          <span className={`${styles.kpiValue} ${sum.net < 0 ? styles.negative : ''}`}>
            {money(sum.net)}
          </span>
          <span className={styles.muted} data-testid="year-rate">
            {sum.savingsRate === undefined ? e.noIncome : e.savingsRate(String(sum.savingsRate))}
          </span>
        </Card>
      </div>
      <Card className={styles.block}>
        <h2 className={styles.chartTitle}>{e.byMonth}</h2>
        {/* The months as two lines above their table; months still to come stay empty, not zero. */}
        <IncomeExpenseChart
          points={sum.months.map((m) => ({ ...m, label: formatDay(`${m.month}-01`, 'MMM') }))}
          title={e.byMonth}
          upTo={monthOf(today())}
          testId="year-chart"
        />
        <table className={styles.table} data-testid="year-months">
          <thead>
            <tr>
              <th scope="col">{t.finance.ext.period.month}</th>
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
            {sum.months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{formatDay(`${m.month}-01`, 'LLLL')}</th>
                <td className={styles.num}>{money(m.income)}</td>
                <td className={styles.num}>{money(m.expense)}</td>
                <td className={styles.num}>{money(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {top.length > 0 ? (
        <Card>
          <h2 className={styles.chartTitle}>{e.topCategories}</h2>
          <CategoryDonut
            rows={top.map((r) => ({
              categoryId: r.categoryId,
              name: name(r.categoryId),
              amountMinor: r.amountMinor,
            }))}
            title={e.topCategories}
            testId="year-categories"
          />
        </Card>
      ) : null}
    </>
  );
}
