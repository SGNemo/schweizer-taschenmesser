import { driveLevel } from '../format';
import styles from './UsageRing.module.css';

/** Fill ring of a drive. The percentage is always written out, so colour is never the only cue. */
export function UsageRing({ percent }: { percent: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const level = driveLevel(percent);
  return (
    <svg
      className={styles.ring}
      viewBox="0 0 80 80"
      role="img"
      aria-label={`${percent} %`}
      data-level={level}
    >
      <circle className={styles.track} cx="40" cy="40" r={r} />
      <circle
        className={styles.value}
        cx="40"
        cy="40"
        r={r}
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="45" textAnchor="middle" className={styles.label}>
        {percent} %
      </text>
    </svg>
  );
}
