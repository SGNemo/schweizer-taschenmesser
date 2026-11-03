import styles from './ArrowBand.module.css';

/**
 * Signature of the downloads: a band that fills with the share done of everything that is running, ending
 * in an arrow tip. The figure and its context line are real text; the band is decoration and takes the
 * module hue. It only changes width when the progress changes (no permanent motion; none at all with
 * reduced motion).
 */
export function ArrowBand({
  figure,
  context,
  percent,
}: {
  figure: string;
  context: string;
  percent: number;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className={styles.band} data-testid="arrow-band">
      <span className={styles.figure}>{figure}</span>
      <span className={styles.context}>{context}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </div>
  );
}
