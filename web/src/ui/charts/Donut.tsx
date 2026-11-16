import { useId } from 'react';
import { t } from '@/strings';
import { arcs, foldShares, formatShare, MAX_SEGMENTS, type ChartDatum } from './model';
import {
  ChartFrame,
  PatternDefs,
  Swatch,
  colourClass,
  defaultFormat,
  patternRef,
  useValueText,
  type ChartBaseProps,
} from './parts';
import styles from './charts.module.css';

export interface DonutProps extends ChartBaseProps {
  /** Shares: only positive values count; largest first, after six the rest is "Sonstiges". */
  data: readonly ChartDatum[];
  /** Small word under the sum in the middle (default "Summe", e.g. "pro Monat"). */
  centreLabel?: string;
  /**
   * Name of the folded rest (default "Sonstiges"). Without it, data that already holds a "Sonstiges" gets "Weitere",
   * so the rest never reads like that one category.
   */
  otherLabel?: string;
}

/** Ring geometry on a 100 × 100 box: radius 42, stroke 16 (the ring is 16 % of the width). */
const R = 42;
/** Gap between two slices, in percent of the circumference: thin enough to read as one ring. */
const GAP = 0.8;

/**
 * Parts of a whole (where the money went, which subscriptions cost most). Largest slice first, clockwise from twelve
 * o'clock, at most six named slices plus "Sonstiges". Slices are steps of the module colour with a pattern each, and
 * the legend beside them names every slice with its value and share: the ring never has to be read by colour.
 */
export function Donut({ data, centreLabel, otherLabel, ...base }: DonutProps) {
  const prefix = `ch${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { show, read, hidden } = useValueText(
    base.format ?? defaultFormat,
    base.sensitive ?? false,
  );
  const rest =
    otherLabel ??
    (data.some((d) => d.label === t.charts.other) ? t.charts.otherMore : t.charts.other);
  const shares = foldShares(data, rest);
  const total = shares.reduce((s, p) => s + p.value, 0);
  const top = shares[0];
  const summary = top
    ? t.charts.donutSummary(shares.length, top.label, formatShare(top.share), read(total))
    : '';

  const slices = arcs(shares, GAP);

  return (
    <ChartFrame
      kind="donut"
      base={base}
      empty={shares.length === 0}
      summary={summary}
      table={
        <>
          <thead>
            <tr>
              <th scope="col">{t.charts.item}</th>
              <th scope="col">{t.charts.value}</th>
              <th scope="col">{t.charts.share}</th>
            </tr>
          </thead>
          <tbody>
            {shares.map((p) => (
              <tr key={p.key}>
                <th scope="row">{p.label}</th>
                <td>{read(p.value) ?? t.widgets.valueHidden}</td>
                <td>{formatShare(p.share)}</td>
              </tr>
            ))}
          </tbody>
        </>
      }
    >
      <div className={styles.donutBody}>
        <div className={styles.donut}>
          <svg viewBox="0 0 100 100" focusable="false">
            <PatternDefs prefix={prefix} count={Math.min(shares.length, MAX_SEGMENTS)} />
            <g transform="rotate(-90 50 50)">
              {slices.map((s) => {
                const pattern = patternRef(prefix, s.index, s.other);
                const dash = `${s.length} ${100 - s.length}`;
                return (
                  <g key={s.key} className={colourClass(s.index, s.other)} data-slice={s.key}>
                    <circle
                      className={styles.seg}
                      cx="50"
                      cy="50"
                      r={R}
                      pathLength={100}
                      strokeDasharray={dash}
                      strokeDashoffset={-s.start}
                    />
                    {pattern ? (
                      <circle
                        className={styles.segPattern}
                        cx="50"
                        cy="50"
                        r={R}
                        pathLength={100}
                        strokeDasharray={dash}
                        strokeDashoffset={-s.start}
                        stroke={pattern}
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
          <div className={styles.centre}>
            <span className={`${styles.centreValue} ${styles.num}`}>{show(total)}</span>
            <span className={styles.centreLabel}>{centreLabel ?? t.charts.total}</span>
          </div>
        </div>
        <ol className={styles.legend} data-hidden={hidden || undefined}>
          {shares.map((p) => (
            <li key={p.key}>
              <Swatch prefix={prefix} index={p.index} other={p.other} />
              <span className={styles.legendName}>{p.label}</span>
              <span className={`${styles.legendValue} ${styles.num}`}>{show(p.value)}</span>
              <span className={`${styles.legendShare} ${styles.num}`}>{formatShare(p.share)}</span>
            </li>
          ))}
        </ol>
      </div>
    </ChartFrame>
  );
}
