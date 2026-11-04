import type { ReactNode } from 'react';
import styles from '../habits.module.css';

/** Empty state with the module's own motif: three dashed, still rings instead of the brand fish. Decoration only. */
export function HabitsEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty} data-testid="habits-empty">
      <svg className={styles.emptyRings} viewBox="0 0 120 40" aria-hidden="true" focusable="false">
        {[20, 60, 100].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy="20"
            r="14"
            fill="none"
            strokeWidth="4"
            strokeDasharray={i === 0 ? '60 100' : '4 7'}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {children}
    </div>
  );
}
