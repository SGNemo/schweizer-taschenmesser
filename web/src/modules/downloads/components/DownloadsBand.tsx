import { ArrowBand } from '@/ui/identity';
import styles from './DownloadsBand.module.css';

/**
 * Signature of the downloads in the head's slot M (identity v3.1): the figure and its context line as real text
 * over the library's `ArrowBand`, filled to the share done of everything that is running (track alone when idle).
 * The band is decoration in the module hue and only changes when the progress does (no motion of its own).
 */
export function DownloadsBand({
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
      <ArrowBand size="M" value={pct / 100} />
    </div>
  );
}
