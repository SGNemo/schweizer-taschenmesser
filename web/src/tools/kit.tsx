/**
 * Building blocks for the content of the tools (docs/howto/new-tool.md): a conversion flow and a timer ring.
 * The look lives in `kit.module.css`; classes for single elements (display, keys, cards) are used directly.
 */
import type { ReactNode } from 'react';
import { numberFormat } from '@/core/i18n/format';
import styles from './kit.module.css';

export { styles as kit };

/** The decimal sign of the current language ("," or "."), for keys that type a number. */
export function decimalSign(): string {
  return (
    numberFormat()
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value ?? '.'
  );
}

/** Start card → between (arrow or swap button) → end card; wraps into a column when narrow. */
export function Flow({
  start,
  between,
  end,
}: {
  start: ReactNode;
  between: ReactNode;
  end: ReactNode;
}) {
  return (
    <div className={styles.flow}>
      <div className={styles.side}>{start}</div>
      <div className={styles.between}>{between}</div>
      <div className={`${styles.side} ${styles.sideEnd}`}>{end}</div>
    </div>
  );
}

/** A big ring that fills with `progress` (0..1); the time and a short line sit in the middle (text carries the meaning). */
export function TimerRing({ progress, children }: { progress: number; children: ReactNode }) {
  const R = 45;
  const C = 2 * Math.PI * R;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={styles.ringWrap}>
      <svg className={styles.ringSvg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={styles.ringTrack} cx="50" cy="50" r={R} />
        <circle
          className={styles.ringArc}
          cx="50"
          cy="50"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
        />
      </svg>
      <div className={styles.ringCentre}>{children}</div>
    </div>
  );
}
