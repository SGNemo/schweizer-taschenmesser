import styles from './Keys.module.css';

/**
 * Key caps for a shortcut: `['T', 'dann R']`, `['F8']`. `decorative` hides them from assistive
 * technology (e.g. inside a list option whose name should be the label only).
 */
export function Keys({
  keys,
  className,
  decorative,
}: {
  keys: readonly string[];
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={[styles.keys, className ?? ''].join(' ').trim()}
      aria-hidden={decorative || undefined}
    >
      {keys.map((k) => (
        <kbd key={k} className={styles.kbd}>
          {k}
        </kbd>
      ))}
    </span>
  );
}
