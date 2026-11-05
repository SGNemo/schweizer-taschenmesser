import { Link } from 'react-router';
import type { ScanProgress } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Card, Icon } from '@/ui';
import { formatBytes, formatCount } from '../format';
import styles from './ScanStatusLine.module.css';

interface Props {
  /** Scan root; named in the line where the page title does not say it already. */
  root?: string;
  progress: ScanProgress | null;
  paused: boolean;
  onPause: () => void;
  onCancel: () => void;
  /** Route of the scan page, for the line on the drives page. */
  to?: string;
}

/**
 * The one calm line of a running scan: its state and what was counted so far (a new figure at
 * most once a second, see `PROGRESS_MS` in the store), with Pause and Abbrechen. No bar, no
 * percentage, no animation (FOCUS-GUIDELINES). Shown on the scan page and, with a link, on the
 * drives page, so the rest of the app stays usable while the scan runs.
 */
export function ScanStatusLine({ root, progress, paused, onPause, onCancel, to }: Props) {
  const state = root
    ? paused
      ? t.disk.scan.pausedOf(root)
      : t.disk.scan.runningOf(root)
    : paused
      ? t.disk.scan.paused
      : t.disk.scan.scanning;
  const soFar = progress
    ? t.disk.scan.soFar(formatCount(progress.files), formatBytes(progress.bytes))
    : null;
  return (
    <Card as="div" className={styles.card} data-testid="scan-status">
      <p className={styles.text}>
        {/* Only the state is announced (it changes on the user's own Pause/Fortsetzen). */}
        <strong role="status">{state}</strong>
        {soFar ? <span className={styles.muted}> · {soFar}</span> : null}
        {to ? (
          <>
            <span className={styles.muted}> · </span>
            <Link to={to} className={styles.link}>
              {t.disk.scan.toScan}
            </Link>
          </>
        ) : null}
      </p>
      <div className={styles.actions}>
        <Button onClick={onPause}>
          <Icon name={paused ? 'play' : 'pause'} size={18} />
          {paused ? t.disk.scan.resume : t.disk.scan.pause}
        </Button>
        <Button variant="danger" onClick={onCancel}>
          {t.disk.scan.cancel}
        </Button>
      </div>
    </Card>
  );
}
