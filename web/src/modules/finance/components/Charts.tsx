import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatMoney, formatMoneyAxis } from '@/core/money';
import { useMediaQuery } from '@/ui';
import { t } from '@/strings';
import type { CategoryTotal, MonthPoint } from '../logic';
import styles from '../routes/finance.module.css';

const AXIS_TEXT = { fill: 'var(--text-muted)', fontSize: 12 } as const;
const BAR = 16; // ≤ 24px thick bars
const ROW = 40;

/** Long category names are cut in the axis; the tooltip and table carry the full text. */
const shorten = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);

function CategoryTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as CategoryTotal | undefined;
  if (!active || !row) return null;
  return (
    <div className={styles.tooltip} data-testid="chart-tooltip">
      <div className={styles.tooltipTitle}>{row.name}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.lineKey} style={{ background: 'var(--viz-1)' }} />
        <span className={styles.tooltipValue}>{formatMoney(row.amountMinor)}</span>
      </div>
    </div>
  );
}

/**
 * Expenses per category. One measure, nominal categories → one colour for all bars, sorted by
 * size, value at the bar tip. Hit target = the bar; the table twin carries every value.
 */
export function CategoryBars({ rows }: { rows: CategoryTotal[] }) {
  const motion = !useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <div style={{ height: rows.length * ROW + 8 }} data-testid="chart-categories">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 88, bottom: 4, left: 0 }}
          barCategoryGap={12}
        >
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="name"
            width={124}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tick={AXIS_TEXT}
            tickFormatter={shorten}
            interval={0}
          />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={CategoryTooltip} />
          <Bar
            dataKey="amountMinor"
            fill="var(--viz-1)"
            barSize={BAR}
            radius={[0, 4, 4, 0]}
            activeBar={{ fillOpacity: 0.8 }}
            isAnimationActive={motion}
            animationDuration={240}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="amountMinor"
              position="right"
              formatter={(v: unknown) => formatMoney(Number(v))}
              fill="var(--text)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const SERIES = [
  {
    key: 'income',
    get name() {
      return t.finance.income;
    },
    color: 'var(--viz-1)',
  },
  {
    key: 'expense',
    get name() {
      return t.finance.expense;
    },
    color: 'var(--viz-2)',
  },
] as const;

function TrendTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as MonthPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className={styles.tooltip} data-testid="chart-tooltip">
      <div className={styles.tooltipTitle}>{point.label}</div>
      {SERIES.map((s) => (
        <div key={s.key} className={styles.tooltipRow}>
          <span className={styles.lineKey} style={{ background: s.color }} />
          <span className={styles.tooltipValue}>{formatMoney(point[s.key])}</span>
          <span className={styles.tooltipName}>{s.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Income vs. expenses per month: two series → legend (rect swatches) above, grouped columns with a 2px gap. */
export function TrendColumns({ points }: { points: MonthPoint[] }) {
  const motion = !useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <div data-testid="chart-trend">
      <ul className={styles.legend} aria-label={t.finance.chartLegend}>
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className={styles.swatch} style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={AXIS_TEXT}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TEXT}
              tickFormatter={(v: number) => formatMoneyAxis(v)}
            />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={TrendTooltip} />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                barSize={14}
                radius={[4, 4, 0, 0]}
                activeBar={{ fillOpacity: 0.8 }}
                isAnimationActive={motion}
                animationDuration={240}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Table twin of the category chart (every value reachable without hover). */
export function CategoryTable({ rows }: { rows: CategoryTotal[] }) {
  return (
    <table className={styles.table} data-testid="table-categories">
      <thead>
        <tr>
          <th scope="col">{t.finance.category}</th>
          <th scope="col" className={styles.num}>
            {t.finance.amount}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.categoryId ?? r.name}>
            <td>{r.name}</td>
            <td className={styles.num}>{formatMoney(r.amountMinor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Table twin of the trend chart. */
export function TrendTable({ points }: { points: MonthPoint[] }) {
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
            <td className={styles.num}>{formatMoney(p.income)}</td>
            <td className={styles.num}>{formatMoney(p.expense)}</td>
            <td className={styles.num}>{formatMoney(p.net)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
