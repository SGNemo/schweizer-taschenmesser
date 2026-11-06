import type { SignatureId, WidgetVariant } from '@/core/modules/types';
import styles from './WidgetMiniature.module.css';

/** Heights of the rising bars of the figure variant (a sketch of a sparkline, not data). */
const SPARK = [30, 42, 36, 55, 48, 70, 62];

/** Fills of the bars sketch (a sketch, not data). */
const BARS = [62, 85, 40];

/**
 * N06: the `fortschritt` shape comes as rings (habits, drives) or bars (planner, budgets, downloads). The library
 * has no widget code at hand, so the module's signature tells: ring-shaped signatures draw rings, the rest bars.
 */
export function progressForm(signature?: SignatureId): 'rings' | 'bars' {
  return signature === 'ring' || signature === 'gauges' ? 'rings' : 'bars';
}

/**
 * A drawn sketch of a widget's shape (identity v3 widget variants): boxes and bars, no text, no data. The
 * library shows it instead of the real widget (which reads live data and would load every module's code),
 * and it is the same for a module that is on and one that is off. Decoration only: hidden from assistive
 * tech. The colour is the surrounding `data-hue`.
 */
export function WidgetMiniature({
  variant,
  signature,
  size = 'sm',
}: {
  variant: WidgetVariant;
  /** The module's signature: picks rings or bars for `fortschritt` (N06). */
  signature?: SignatureId;
  size?: 'sm' | 'lg';
}) {
  const form = variant === 'fortschritt' ? progressForm(signature) : undefined;
  return (
    <span
      className={styles.mini}
      data-variant={variant}
      data-form={form}
      data-size={size}
      aria-hidden="true"
      data-testid="widget-miniature"
    >
      {variant === 'kennzahl' ? (
        <>
          <span className={styles.figure} />
          <span className={styles.line} />
          <span className={styles.spark}>
            {SPARK.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </span>
        </>
      ) : null}
      {variant === 'zeitleiste' ? (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.row}>
              <span className={styles.dot} />
              <span className={styles.line} data-w={i} />
            </span>
          ))}
        </>
      ) : null}
      {form === 'bars' ? (
        <span className={styles.stack}>
          {BARS.map((w, i) => (
            <span key={i} className={styles.barRow}>
              <span className={styles.line} data-w={i} />
              <span className={styles.bar}>
                <span style={{ width: `${w}%` }} />
              </span>
            </span>
          ))}
        </span>
      ) : null}
      {form === 'rings' ? (
        <>
          <span className={styles.ring} />
          <span className={styles.stack}>
            <span className={styles.line} />
            <span className={styles.line} data-w="1" />
          </span>
        </>
      ) : null}
      {variant === 'cover' ? (
        <>
          <span className={styles.cover} />
          <span className={styles.stack}>
            <span className={styles.line} />
            <span className={styles.line} data-w="1" />
            <span className={styles.controls}>
              <span className={styles.dot} />
              <span className={styles.dot} data-big="true" />
              <span className={styles.dot} />
            </span>
          </span>
        </>
      ) : null}
      {variant === 'himmel' ? (
        <>
          <span className={styles.sun} />
          <span className={styles.figure} data-w="1" />
          <span className={styles.line} />
        </>
      ) : null}
      {variant === 'kacheln' ? (
        <span className={styles.tiles}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={styles.tile}>
              <span className={styles.line} data-w="2" />
            </span>
          ))}
        </span>
      ) : null}
      {variant === 'status' ? (
        <>
          <span className={styles.plate} />
          <span className={styles.line} />
          <span className={styles.pill} />
        </>
      ) : null}
      {variant === 'notiz' ? (
        <span className={styles.paper}>
          <span className={styles.line} />
          <span className={styles.line} data-w="1" />
          <span className={styles.line} data-w="2" />
        </span>
      ) : null}
      {variant === 'fokus' ? (
        <>
          <span className={styles.figure} data-w="1" />
          <span className={styles.line} />
          <span className={styles.pill} data-primary="true" />
        </>
      ) : null}
      {variant === 'faellig' ? (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.row}>
              <span className={styles.line} data-w={i} />
              <span className={styles.badge} />
            </span>
          ))}
        </>
      ) : null}
      {variant === 'checkliste' ? (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.row}>
              <span className={styles.box} data-done={i === 0} />
              <span className={styles.line} data-w={i} />
            </span>
          ))}
        </>
      ) : null}
    </span>
  );
}
