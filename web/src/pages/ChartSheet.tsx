/** Dev-Preview / E2E only: the shared charts (`@/ui/charts`) in every state, as a section of the component sheet. */
import { formatMoney, formatMoneyAxis } from '@/core/money';
import { tDev } from '@/strings.dev';
import { Card } from '@/ui';
import { Bars, Donut, Spark, Trend } from '@/ui/charts';
import styles from './ComponentSheet.module.css';

const c = tDev.components.charts;
const euro = (cents: number) => formatMoney(cents);
/** Invented cents, fixed so screenshots stay the same. */
const SPEND = [85000, 41230, 12890, 9400, 7600, 4790, 3900, 2500, 1200];
const INCOME = [
  310000, 310000, 312000, 310000, 335000, 310000, 310000, 318000, 310000, 310000, 362000, 310000,
];
const EXPENSE = [
  251000, 236400, 244800, 262100, 231900, 248300, 270400, 301200, 244900, 239100, 252700, 233800,
];
const LAST_YEAR = [
  240000, 228000, 239000, 250000, 236000, 241000, 255000, 280000, 238000, 242000, 247000, 230000,
];
const BALANCE = [
  412000, 486000, 553000, 601000, 704000, 765900, 805500, 822300, 887400, 958300, 1067600, 1143800,
];

export function ChartSheet() {
  const shares = c.categories.map((label, i) => ({ label, value: SPEND[i]! }));
  return (
    <section className={styles.section} aria-labelledby="cs-charts">
      <h2 id="cs-charts">{c.title}</h2>
      <div className={styles.grid} data-testid="chart-sheet">
        <Card>
          <Donut
            title={c.donut}
            showTitle
            data={shares.slice(0, 5)}
            format={euro}
            sensitive
            data-testid="cs-donut"
          />
        </Card>
        <Card>
          <Donut title={c.donutMany} showTitle data={shares} format={euro} />
        </Card>
        <Card>
          <Donut title={c.donutOne} showTitle data={shares.slice(0, 1)} format={euro} />
        </Card>
        <Card>
          <Bars
            title={c.bars}
            showTitle
            format={euro}
            sensitive
            data-testid="cs-bars"
            data={[
              { label: c.categories[1]!, value: 41230, target: 40000 },
              { label: c.categories[2]!, value: 12890, target: 15000 },
              { label: c.categories[3]!, value: 9400, target: 12000 },
              { label: c.categories[6]!, value: 0, target: 5000 },
            ]}
          />
        </Card>
        <Card>
          <Bars
            title={c.barsVertical}
            showTitle
            orientation="vertical"
            format={euro}
            data={c.months.map((label, i) => ({ label, value: EXPENSE[i]!, target: 250000 }))}
          />
        </Card>
        <Card>
          <Trend
            title={c.trend}
            showTitle
            labels={c.months}
            format={euro}
            formatAxis={formatMoneyAxis}
            series={[
              { label: c.income, values: INCOME },
              { label: c.expense, values: EXPENSE },
            ]}
            compare={{ label: c.lastYear, values: LAST_YEAR }}
            data-testid="cs-trend"
          />
        </Card>
        <Card>
          <Trend
            title={c.trendArea}
            showTitle
            variant="area"
            labels={c.months}
            format={euro}
            formatAxis={formatMoneyAxis}
            series={[{ label: c.balance, values: BALANCE }]}
          />
        </Card>
        <Card>
          <h3>{c.spark}</h3>
          <Spark values={BALANCE.slice(-6)} label={c.sparkLabel} />
          <Spark values={BALANCE.slice(-6)} variant="area" />
        </Card>
        <Card>
          <Donut title={c.empty} showTitle data={[]} />
          <Trend title={c.empty} labels={[]} series={[]} />
        </Card>
      </div>
    </section>
  );
}
