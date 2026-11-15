import type { CSSProperties } from 'react';
import { t } from '@/strings';
import { areaPath, fraction, labelIndexes, lastValue, linePath, niceScale } from './model';
import {
  ChartFrame,
  defaultFormat,
  useValueText,
  type ChartBaseProps,
  type ValueFormat,
} from './parts';
import styles from './charts.module.css';

/** One line: a value per label (`null` = no value there, the line pauses). */
export interface TrendSeries {
  id?: string;
  label: string;
  values: readonly (number | null)[];
}

export interface TrendProps extends ChartBaseProps {
  /** Names of the points along the x axis (months, days), oldest first. */
  labels: readonly string[];
  /** One or two series; the first in the module colour, the second dashed in `--viz-2`. */
  series: readonly TrendSeries[];
  /** Optional earlier period on the same labels (last year): dotted grey, behind the series. */
  compare?: TrendSeries;
  /** `area` fills under the first series and starts the scale at zero; `line` (default) may start elsewhere. */
  variant?: 'line' | 'area';
  /** Shorter text for the value axis (e.g. "1,2 k €"); default: `format`. */
  formatAxis?: ValueFormat;
}

const X_LABELS = { narrow: 4, wide: 8 } as const;
const SERIES_CLASS = [styles.s0, styles.s1] as const;

/**
 * A value over time (balance, spending per month). Up to two series plus an earlier period to compare; the series
 * differ by line style (solid, dashed, dotted) as well as colour, and the legend names each with its latest value.
 * Only the newest point gets a dot. Axis labels thin out on narrow widths; the table holds every value.
 */
export function Trend({
  labels,
  series: input,
  compare,
  variant = 'line',
  formatAxis,
  ...base
}: TrendProps) {
  const format = base.format ?? defaultFormat;
  const { show, read, hidden } = useValueText(format, base.sensitive ?? false);
  const axisText = (v: number) => (hidden ? '' : (formatAxis ?? format)(v));
  const series = input.slice(0, 2);
  const n = labels.length;
  const all = [...series, ...(compare ? [compare] : [])];
  const values = all
    .flatMap((s) => s.values.slice(0, n))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const empty = n === 0 || values.length === 0;
  const scale = niceScale(values, { zero: variant === 'area', count: 4 });
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const narrow = labelIndexes(n, X_LABELS.narrow);
  const wide = labelIndexes(n, X_LABELS.wide);
  /** One sentence per series (every series is named; the table has every value). */
  const summary = all
    .map((s) => {
      const own = s.values.slice(0, n);
      const known = own.filter((v): v is number => v != null && Number.isFinite(v));
      const last = lastValue(own);
      return t.charts.trendSummary(
        s.label,
        known.length,
        known.length ? read(known[0]!) : null,
        last ? read(last.v) : null,
      );
    })
    .join(' ');
  const keyed = series.length > 1 || compare != null;

  const ownLines = series.map((s, i) => ({ s, cls: SERIES_CLASS[i]! }));
  const compareLine = compare ? [{ s: compare, cls: styles.sCompare }] : [];
  /** Drawing order: the comparison behind the series. */
  const lines = [...compareLine, ...ownLines];
  /** Legend order: the series first. */
  const keys = [...ownLines, ...compareLine];

  return (
    <ChartFrame
      kind="trend"
      base={base}
      empty={empty}
      summary={summary}
      table={
        <>
          <thead>
            <tr>
              <th scope="col">{t.charts.item}</th>
              {all.map((s, i) => (
                <th key={s.id ?? i} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={i}>
                <th scope="row">{label}</th>
                {all.map((s, j) => {
                  const v = s.values[i];
                  return (
                    <td key={s.id ?? j}>
                      {v == null || !Number.isFinite(v) ? '–' : (read(v) ?? t.widgets.valueHidden)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </>
      }
    >
      <div className={styles.trend}>
        <div className={styles.yAxis}>
          {scale.ticks.map((v) => (
            <span
              key={v}
              className={`${styles.yTick} ${styles.num}`}
              style={{ '--f': fraction(v, scale) } as CSSProperties}
            >
              {axisText(v)}
            </span>
          ))}
          <span className={`${styles.yWidth} ${styles.num}`}>
            {scale.ticks.map((v) => (
              <span key={v} className={styles.yWidth}>
                {axisText(v)}
              </span>
            ))}
          </span>
        </div>
        <div className={styles.plot}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            {scale.ticks.map((v) => (
              <line
                key={v}
                className={v === 0 ? styles.zeroLine : styles.gridLine}
                x1="0"
                x2="100"
                y1={100 - fraction(v, scale) * 100}
                y2={100 - fraction(v, scale) * 100}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {variant === 'area' && series[0] ? (
              <path className={styles.area} d={areaPath(series[0].values.slice(0, n), scale)} />
            ) : null}
            {lines.map(({ s, cls }, i) => (
              <path
                key={s.id ?? i}
                className={`${styles.line} ${cls}`}
                d={linePath(s.values.slice(0, n), scale)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {series.map((s, i) => {
            const last = lastValue(s.values.slice(0, n));
            return last ? (
              <span
                key={s.id ?? i}
                className={`${styles.dot} ${SERIES_CLASS[i]}`}
                style={{ '--x': x(last.i), '--f': fraction(last.v, scale) } as CSSProperties}
              />
            ) : null;
          })}
        </div>
        <div className={styles.xAxis}>
          {labels.map((label, i) =>
            narrow.has(i) || wide.has(i) ? (
              <span
                key={i}
                className={`${styles.xLabel} ${styles.thin}`}
                style={{ '--x': x(i) } as CSSProperties}
                data-edge={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : undefined}
                data-n={narrow.has(i) || undefined}
                data-w={wide.has(i) || undefined}
              >
                {label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      {keyed ? (
        <ul className={styles.keys}>
          {keys.map(({ s, cls }, i) => {
            const last = lastValue(s.values.slice(0, n));
            return (
              <li key={s.id ?? i}>
                <svg className={styles.lineKey} viewBox="0 0 20 8" focusable="false">
                  <path className={`${styles.line} ${cls}`} d="M1 4H19" />
                </svg>
                <span>{s.label}</span>
                {last ? (
                  <span className={`${styles.num} ${styles.muted}`}>
                    {t.charts.latest(labels[last.i] ?? '', show(last.v))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </ChartFrame>
  );
}
