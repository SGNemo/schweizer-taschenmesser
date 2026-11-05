import styles from '../habits.module.css';

/** The habits motif for the shared `EmptyState` (F11): three dashed, still rings. Decoration only. */
export function HabitsMotif() {
  return (
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
  );
}
