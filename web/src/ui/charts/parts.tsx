import { useId, type ReactNode } from 'react';
import { useHideValues } from '@/core/focus/hideValues';
import { HIDDEN_AMOUNT } from '@/core/focus/maskAmounts';
import { formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import styles from './charts.module.css';

/** Turns a value into text: `formatNumber` by default, `(n) => formatMoney(n, currency)` for cents. */
export type ValueFormat = (value: number) => string;

export const defaultFormat: ValueFormat = (n) => formatNumber(n);

/**
 * Text for a value, honouring "Werte ausblenden" when the chart shows amounts (`sensitive`). Hidden, the marks keep
 * their shape and every amount reads as the mask, in the table as "Ausgeblendet". `true` while the setting loads,
 * so an amount never flashes.
 */
export function useValueText(format: ValueFormat, sensitive: boolean) {
  const hidden = useHideValues() && sensitive;
  return {
    hidden,
    /** Visible text (aria-hidden places). */
    show: (v: number) => (hidden ? HIDDEN_AMOUNT : format(v)),
    /** Text for the screen-reader table and summary; `null` while hidden. */
    read: (v: number) => (hidden ? null : format(v)),
  };
}

/** Base props every chart takes. */
export interface ChartBaseProps {
  /** Name of the chart: the figure's accessible name and the table's caption. Shown only with `showTitle`. */
  title: string;
  /** Show the title above the chart (off when the surrounding card already has a heading). */
  showTitle?: boolean;
  /** Value text (axis, legend, table). Default: the app's number format. */
  format?: ValueFormat;
  /** The values are amounts: hide them with "Werte ausblenden". */
  sensitive?: boolean;
  /** Text when there is nothing to draw. Default: "Noch keine Werte." */
  emptyText?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * The frame of every chart: a `figure` named by its title, a summary sentence and a table for screen readers, the
 * visible marks and legend hidden from them (the table carries every value they show).
 */
export function ChartFrame({
  kind,
  base,
  empty,
  summary,
  table,
  children,
}: {
  kind: 'donut' | 'bars' | 'trend';
  base: ChartBaseProps;
  empty: boolean;
  summary: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <figure
      className={`${styles.frame} ${base.className ?? ''}`}
      aria-labelledby={`${id}-t`}
      aria-describedby={empty ? undefined : `${id}-s`}
      data-chart={kind}
      data-testid={base['data-testid']}
    >
      <figcaption id={`${id}-t`} className={base.showTitle ? styles.title : 'sr-only'}>
        {base.title}
      </figcaption>
      {empty ? (
        <p className={styles.empty}>{base.emptyText ?? t.charts.empty}</p>
      ) : (
        <>
          <p id={`${id}-s`} className="sr-only">
            {summary}
          </p>
          <div aria-hidden="true">{children}</div>
          {/* A table ignores a 1 px width; the wrapper keeps it out of the layout. */}
          <div className="sr-only">
            <table className={styles.srTable}>
              <caption>{base.title}</caption>
              {table}
            </table>
          </div>
        </>
      )}
    </figure>
  );
}

/** Pattern slots: none on the first share, then diagonal, dots, horizontal, checks, vertical – apart in grey too. */
const PATTERNS: readonly (((ink: string) => ReactNode) | null)[] = [
  null,
  (ink) => <path className={ink} d="M-1 1l2-2M0 6l6-6M5 7l2-2" strokeWidth="1.2" />,
  (ink) => <circle className={ink} cx="3" cy="3" r="1.1" stroke="none" />,
  (ink) => <path className={ink} d="M0 3h6" strokeWidth="1.2" />,
  (ink) => <path className={ink} d="M0 0h3v3H0zM3 3h3v3H3z" stroke="none" />,
  (ink) => <path className={ink} d="M3 0v6" strokeWidth="1.2" />,
];
/** The "Sonstiges" slot: a cross-hatch on grey. */
const OTHER_PATTERN = (ink: string) => <path className={ink} d="M0 3h6M3 0v6" strokeWidth="0.9" />;

export const colourClass = (index: number, other: boolean) =>
  other
    ? styles.cOther
    : ([styles.c0, styles.c1, styles.c2, styles.c3, styles.c4, styles.c5][index] ?? styles.c5);

/** `url(#…)` of the pattern for a slot, or `null` for the plain first slot. */
export const patternRef = (prefix: string, index: number, other: boolean) =>
  other || PATTERNS[index] ? `url(#${prefix}-p${other ? 'o' : index})` : null;

/** `<defs>` with the patterns of `count` slots (+ the "Sonstiges" one); ids start with `prefix`. */
export function PatternDefs({ prefix, count }: { prefix: string; count: number }) {
  return (
    <defs>
      {PATTERNS.slice(0, count).map((draw, i) =>
        draw ? (
          <pattern
            key={i}
            id={`${prefix}-p${i}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            {draw(styles.patternInk!)}
          </pattern>
        ) : null,
      )}
      <pattern id={`${prefix}-po`} width="6" height="6" patternUnits="userSpaceOnUse">
        {OTHER_PATTERN(styles.patternInk!)}
      </pattern>
    </defs>
  );
}

/** Legend swatch: the slot's colour and pattern, so a legend row and its share match without colour. */
export function Swatch({
  prefix,
  index,
  other,
}: {
  prefix: string;
  index: number;
  other: boolean;
}) {
  const pattern = patternRef(prefix, index, other);
  return (
    <svg className={`${styles.swatch} ${colourClass(index, other)}`} viewBox="0 0 14 14">
      <rect width="14" height="14" />
      {pattern ? <rect width="14" height="14" fill={pattern} /> : null}
    </svg>
  );
}
