import type { WidgetVariant } from '@/core/modules/types';
import styles from './WidgetMiniature.module.css';

/** Heights of the rising bars of the figure variant (a sketch of a sparkline, not data). */
const SPARK = [30, 42, 36, 55, 48, 70, 62];

/**
 * A drawn sketch of a widget's shape (identity v3 widget variants): boxes and bars, no text, no data. The
 * library shows it instead of the real widget (which reads live data and would load every module's code),
 * and it is the same for a module that is on and one that is off. Decoration only: hidden from assistive
 * tech. The colour is the surrounding `data-hue`.
 */
export function WidgetMiniature({
  variant,
  size = 'sm',
}: {
  variant: WidgetVariant;
  size?: 'sm' | 'lg';
}) {
  return (
    <span
      className={styles.mini}
      data-variant={variant}
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
      {variant === 'fortschritt' ? (
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
