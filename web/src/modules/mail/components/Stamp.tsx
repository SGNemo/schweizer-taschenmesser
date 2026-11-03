import styles from './Stamp.module.css';

/**
 * Signature of the mail module: a postage stamp with a perforated edge. The unread count is real text
 * (the figure), the stamp itself only frames it; with no unread mail it says so in words. The edge is
 * decoration (hidden from assistive technology), the colour is the module hue and carries no meaning.
 */
export function Stamp({
  count,
  label,
  context,
}: {
  count: number;
  label: string;
  context: string;
}) {
  return (
    <div className={styles.stamp} data-testid="mail-stamp">
      <span className={styles.edge} aria-hidden="true" />
      <div className={styles.face}>
        <span className={styles.figure}>{count}</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.context}>{context}</span>
      </div>
    </div>
  );
}
