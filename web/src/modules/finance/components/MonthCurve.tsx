import { formatMoney } from '@/core/money';
import { t } from '@/strings';
import { Card } from '@/ui';
import { useCurrency } from '../currency';
import type { DayPoint } from '../balanceSeries';
import styles from '../routes/finance.module.css';

const W = 640;
const H = 180;
const PAD = 6;

/**
 * The month as one area: the balance at the end of each day, in the module hue. A line with its fill, the start and end value
 * as text ("a context line for every number"); the booking list beside it carries every single value.
 */
export function MonthCurve({
  points,
  title = t.finance.balanceCurve,
  fromLabel = t.finance.curveFrom,
  testId = 'month-curve',
}: {
  points: DayPoint[];
  title?: string;
  fromLabel?: string;
  testId?: string;
}) {
  const currency = useCurrency();
  if (points.length < 2) return null;
  const values = points.map((p) => p.balanceMinor);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.balanceMinor).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const first = points[0]!.balanceMinor;
  const last = points[points.length - 1]!.balanceMinor;
  return (
    <Card>
      <h2 className={styles.chartTitle}>{title}</h2>
      <svg
        className={styles.curve}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.finance.curveLabel(formatMoney(first, currency), formatMoney(last, currency))}
        data-testid={testId}
      >
        <path d={area} className={styles.curveFill} />
        <path d={line} className={styles.curveLine} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.curveFoot}>
        <span>
          {fromLabel} · {formatMoney(first, currency)}
        </span>
        <span className={last >= first ? styles.income : undefined}>
          {formatMoney(last, currency)}
        </span>
      </div>
    </Card>
  );
}
