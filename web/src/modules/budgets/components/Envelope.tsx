import styles from '../routes/budgets.module.css';

/**
 * Signature of Budgets: a small envelope whose fill level rises with the spent share. Decoration (the flap and the
 * level are `aria-hidden`); the name and the percentage are text. Over the limit the level turns to the danger tint
 * and the page says so in words.
 */
export function EnvelopeMini({ name, pct, over }: { name: string; pct: number; over?: boolean }) {
  return (
    <div className={`${styles.mini} ${over ? styles.miniOver : ''}`} data-testid="envelope">
      <span className={styles.level} style={{ height: `${Math.min(100, pct)}%` }} aria-hidden />
      <span className={styles.flap} aria-hidden />
      <span className={styles.miniText}>
        <span>{name}</span>
        <strong>{pct} %</strong>
      </span>
    </div>
  );
}
