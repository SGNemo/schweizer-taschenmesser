import styles from './Keys.module.css';

/** Key caps for a shortcut: `['T', 'dann R']`, `['F8']`. */
export function Keys({ keys, className }: { keys: readonly string[]; className?: string }) {
  return (
    <span className={[styles.keys, className ?? ''].join(' ').trim()}>
      {keys.map((k) => (
        <kbd key={k} className={styles.kbd}>
          {k}
        </kbd>
      ))}
    </span>
  );
}
