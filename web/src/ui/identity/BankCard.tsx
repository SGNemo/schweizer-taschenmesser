import styles from './BankCard.module.css';

/**
 * Card look for an account (finance head and widget): the balance large, "available" below, last digits optional.
 * Decoration around real numbers: the figures are text in the DOM. `second` uses the module's second hue.
 */
export function BankCard({
  name,
  balance,
  detail,
  tail,
  second = false,
  compact = false,
}: {
  name: string;
  balance: string;
  detail?: string;
  tail?: string;
  second?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? `${styles.card} ${styles.compact}` : styles.card}
      data-second={second ? 'true' : undefined}
      data-testid="bank-card"
    >
      <span className={styles.name}>{name}</span>
      <span className={styles.balance}>{balance}</span>
      <span className={styles.foot}>
        {detail ? <span>{detail}</span> : <span />}
        {tail ? <span aria-hidden="true">{tail}</span> : null}
      </span>
    </div>
  );
}
