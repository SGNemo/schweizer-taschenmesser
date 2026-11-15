import type { CSSProperties } from 'react';
import { t } from '@/strings';
import { Icon } from '../icons';
import { fraction, labelIndexes, type ChartDatum } from './model';
import { ChartFrame, defaultFormat, useValueText, type ChartBaseProps } from './parts';
import styles from './charts.module.css';

export interface BarDatum extends ChartDatum {
  /** Planned value (budget, limit): drawn as a mark; a value above it is "over" (red with icon and text). */
  target?: number;
}

export interface BarsProps extends ChartBaseProps {
  data: readonly BarDatum[];
  /** `horizontal` (default): one row per value, names left – categories, budgets. `vertical`: columns – months. */
  orientation?: 'horizontal' | 'vertical';
  /** Name of the target in the key and the table (e.g. "Budget"); default "Geplant". */
  targetLabel?: string;
}

/** Labels under columns: at most this many in a narrow chart, more from 36 rem. */
const COL_LABELS = { narrow: 6, wide: 12 } as const;
/** Values over columns need about 4.5 rem each (an amount): only up to this many columns. */
const COL_VALUES = { narrow: 4, wide: 7 } as const;

const usable = (v: number | undefined): v is number => v != null && Number.isFinite(v);

/**
 * Values side by side, one colour, scale from zero. With a `target` each bar gets a mark; only the part of a value
 * beyond its target turns red, always with an icon (and "… drüber" in rows, in the key under columns). Negative
 * values are drawn as zero (the table still says the value); a chart of gains and losses is a `Trend`.
 */
export function Bars({ data, orientation = 'horizontal', targetLabel, ...base }: BarsProps) {
  const { show, read, hidden } = useValueText(
    base.format ?? defaultFormat,
    base.sensitive ?? false,
  );
  const rows = data.filter((d) => Number.isFinite(d.value));
  const top = Math.max(0, ...rows.map((d) => d.value), ...rows.map((d) => d.target).filter(usable));
  // No axis to read round numbers from: the longest bar (or mark) fills the track.
  const scale = { min: 0, max: top || 1 };
  const isOver = (d: BarDatum) => usable(d.target) && d.value > d.target;
  const overCount = rows.filter(isOver).length;
  const hasTarget = rows.some((d) => usable(d.target));
  const overText = (d: BarDatum) =>
    hidden ? t.charts.overPlain : t.charts.over(show(d.value - (d.target ?? 0)));

  const table = (
    <>
      <thead>
        <tr>
          <th scope="col">{t.charts.item}</th>
          <th scope="col">{t.charts.value}</th>
          {hasTarget ? <th scope="col">{targetLabel ?? t.charts.target}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((d, i) => (
          <tr key={d.id ?? i}>
            <th scope="row">{d.label}</th>
            <td>
              {read(d.value) ?? t.widgets.valueHidden}
              {isOver(d) ? ` (${overText(d)})` : ''}
            </td>
            {hasTarget ? (
              <td>{usable(d.target) ? (read(d.target) ?? t.widgets.valueHidden) : '–'}</td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </>
  );

  const vars = (d: BarDatum, i: number) =>
    ({
      '--v': fraction(Math.max(0, d.value), scale),
      '--t': usable(d.target) ? fraction(d.target, scale) : 0,
      '--i': i,
    }) as CSSProperties;

  return (
    <ChartFrame
      kind="bars"
      base={base}
      empty={rows.length === 0}
      summary={t.charts.barsSummary(rows.length, overCount)}
      table={table}
    >
      {orientation === 'horizontal' ? (
        <ul className={styles.bars}>
          {rows.map((d, i) => (
            <li
              key={d.id ?? i}
              className={styles.barRow}
              style={vars(d, i)}
              data-over={isOver(d) || undefined}
            >
              <span className={styles.barLabel}>{d.label}</span>
              <span className={styles.track}>
                <Bar d={d} isOver={isOver} className={styles.bar} />
                {usable(d.target) ? <span className={styles.mark} /> : null}
              </span>
              <span className={styles.barValue}>
                {show(d.value)}
                {usable(d.target) && !isOver(d) ? (
                  <span className={styles.muted}> {t.charts.ofTarget(show(d.target))}</span>
                ) : null}
              </span>
              {isOver(d) ? (
                <span className={styles.over}>
                  <Icon name="alert" size={14} />
                  {overText(d)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Columns rows={rows} vars={vars} show={show} isOver={isOver} />
      )}
      {hasTarget ? (
        <p className={styles.key}>
          <span className={styles.targetKey}>{targetLabel ?? t.charts.target}</span>
          {overCount > 0 && orientation === 'vertical' ? (
            <span className={styles.overKey}>
              <Icon name="alert" size={14} />
              {t.charts.overKey}
            </span>
          ) : null}
        </p>
      ) : null}
    </ChartFrame>
  );
}

function Columns({
  rows,
  vars,
  show,
  isOver,
}: {
  rows: readonly BarDatum[];
  vars: (d: BarDatum, i: number) => CSSProperties;
  show: (v: number) => string;
  isOver: (d: BarDatum) => boolean;
}) {
  const narrow = labelIndexes(rows.length, COL_LABELS.narrow);
  const wide = labelIndexes(rows.length, COL_LABELS.wide);
  const valuesNarrow = rows.length <= COL_VALUES.narrow;
  const valuesWide = rows.length <= COL_VALUES.wide;
  return (
    <div className={styles.cols}>
      {rows.map((d, i) => (
        <div key={d.id ?? i} className={styles.col} style={vars(d, i)}>
          <span className={styles.colValue} data-over={isOver(d) || undefined}>
            {isOver(d) ? <Icon name="alert" size={14} /> : null}
            <span
              className={styles.thin}
              data-n={valuesNarrow || undefined}
              data-w={valuesWide || undefined}
            >
              {show(d.value)}
            </span>
          </span>
          <span className={styles.colArea}>
            <Bar d={d} isOver={isOver} className={styles.colBar} />
            {usable(d.target) ? <span className={styles.colMark} /> : null}
          </span>
          <span
            className={`${styles.colLabel} ${styles.thin}`}
            data-n={narrow.has(i) || undefined}
            data-w={wide.has(i) || undefined}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The bar of one value; the part beyond the target is a red child, so it grows with the bar. */
function Bar({
  d,
  isOver,
  className,
}: {
  d: BarDatum;
  isOver: (d: BarDatum) => boolean;
  className: string | undefined;
}) {
  return (
    <span className={className} data-zero={d.value <= 0 || undefined}>
      {isOver(d) ? <span className={styles.overPart} /> : null}
    </span>
  );
}
