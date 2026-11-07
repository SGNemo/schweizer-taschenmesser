import { formatMoney } from '@/core/money';
import { formatMonth } from '@/core/time/dates';
import { t } from '@/strings';
import { Card } from '@/ui';
import { useCurrency } from '../currency';
import type { MonthPoint } from '../netWorth';
import styles from '../routes/finance.module.css';

const W = 640;
const H = 180;
const PAD = 6;

/**
 * A line over months (net worth; reusable for a category trend). Same look as the month curve; the
 * first and last value are text, and a table below carries every single value for screen readers.
 */
export function TrendChart({
  points,
  title,
  testId = 'trend-chart',
}: {
  points: MonthPoint[];
  title: string;
  testId?: string;
}) {
  const currency = useCurrency();
  if (points.length < 2) return null;
  const values = points.map((p) => p.valueMinor);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.valueMinor).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <Card>
      <h2 className={styles.chartTitle}>{title}</h2>
      <svg
        className={styles.curve}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.finance.curveLabel(
          formatMoney(first.valueMinor, currency),
          formatMoney(last.valueMinor, currency),
        )}
        data-testid={testId}
      >
        <path d={area} className={styles.curveFill} />
        <path d={line} className={styles.curveLine} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.curveFoot}>
        <span>
          {formatMonth(first.month)} · {formatMoney(first.valueMinor, currency)}
        </span>
        <span>
          {formatMonth(last.month)} · {formatMoney(last.valueMinor, currency)}
        </span>
      </div>
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
    </Card>
  );
}
