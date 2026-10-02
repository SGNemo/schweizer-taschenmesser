import type { ReactNode } from 'react';
import styles from './Widgets.module.css';

export type RingLevel = 'ok' | 'tight' | 'full';

/**
 * Fill ring. The value is always written inside (or via `children`), so colour is never the only
 * cue. `level` colours the arc: `tight` warning, `full` danger.
 */
export function Ring({
  percent,
  level = 'ok',
  size = 'md',
  label,
  children,
}: {
  percent: number;
  level?: RingLevel;
  size?: 'sm' | 'md';
  label: string;
  children?: ReactNode;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <span className={styles.ring} data-size={size} data-level={level}>
      <svg viewBox="0 0 80 80" role="img" aria-label={`${label}: ${Math.round(pct)} %`}>
        <circle className={styles.ringTrack} cx="40" cy="40" r={r} />
        <circle
          className={styles.ringValue}
          cx="40"
          cy="40"
          r={r}
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className={styles.ringText} aria-hidden="true">
        {children ?? `${Math.round(pct)} %`}
      </span>
    </span>
  );
}
