import { formatMoney } from '@/core/money';
import { formatMonth } from '@/core/time/dates';
import { t } from '@/strings';
import { useHideValues } from '@/core/focus/hideValues';
import { Card, SensitiveValue } from '@/ui';
import { useCurrency } from '../currency';
import { changeOver, type MonthPoint } from '../netWorth';
import styles from '../routes/finance.module.css';

const W = 640;
const H = 180;
const PAD = 6;

/**
 * The net worth as a line over months (its label for screen readers names the net worth). A line only, no filled
 * area: the scale does not start at zero (a small change stays visible), and a fill down to the lower edge would say
 * it does. The first and last value are text, and a table below carries every single value for screen readers.
 */
export function TrendChart({
  points,
  title,
  testId = 'trend-chart',
  lastElsewhere = false,
}: {
  points: MonthPoint[];
  title: string;
  testId?: string;
  /** Today's value is the page's head figure already: the foot names the last month without repeating the amount. */
  lastElsewhere?: boolean;
}) {
  const currency = useCurrency();
  // "Werte ausblenden": the line keeps its shape, every amount around it (label, foot, table) is masked.
  const hide = useHideValues();
  if (points.length < 2) return null;
  const values = points.map((p) => p.valueMinor);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Padded domain so a small change does not look like a crash; a flat series sits at mid-height.
  const raw = hi - lo;
  const pad = raw === 0 ? Math.max(Math.abs(hi) * 0.1, 100) : raw * 0.1;
  const lo2 = lo - pad;
  const span = hi + pad - lo2;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo2) / span) * (H - 2 * PAD);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.valueMinor).toFixed(1)}`)
    .join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const change = changeOver(points)!;
  const sinceLabel = formatMonth(change.since);
  const changeText =
    change.diffMinor === 0
      ? t.finance.netWorthUnchanged(sinceLabel)
      : t.finance.netWorthChange(
          `${change.diffMinor > 0 ? '+' : ''}${formatMoney(change.diffMinor, currency)}`,
          sinceLabel,
        );
  return (
    <Card>
      <h2 className={styles.chartTitle}>{title}</h2>
      <svg
        className={styles.curve}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          hide
            ? title
            : t.finance.netWorth.curve(
                formatMoney(first.valueMinor, currency),
                formatMoney(last.valueMinor, currency),
              )
        }
        data-testid={testId}
      >
        <path d={line} className={styles.curveLine} vectorEffect="non-scaling-stroke" />
      </svg>
      <SensitiveValue>
        <div className={styles.curveFoot} data-testid={`${testId}-foot`}>
          <span>
            {formatMonth(first.month)} · {formatMoney(first.valueMinor, currency)}
          </span>
          <span>
            {formatMonth(last.month)}
            {lastElsewhere ? null : ` · ${formatMoney(last.valueMinor, currency)}`}
          </span>
        </div>
        <p className={styles.curveFoot} data-testid={`${testId}-change`}>
          {changeText}
        </p>
        <table className="sr-only">
          <caption>{title}</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <th scope="row">{formatMonth(p.month)}</th>
                <td>{formatMoney(p.valueMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SensitiveValue>
    </Card>
  );
}
