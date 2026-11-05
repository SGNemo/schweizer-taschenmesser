import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { ScanProgress } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Card, Icon } from '@/ui';
import { formatBytes, formatCount } from '../format';
import styles from './ScanStatusLine.module.css';

interface Props {
  /** State of the scan ("Scan läuft", "Scan von C:\ beendet" …); announced when it changes. */
  state: string;
  /** Second part of the line: what was counted so far, or the reason of a failure. */
  detail?: string;
  /** Link at the end of the line where the page is not the scan page itself. */
  to?: string;
  linkText?: string;
  /** Pause and Abbrechen while the scan runs; left out once it ended. */
  actions?: { paused: boolean; onPause: () => void; onCancel: () => void };
  /** Without its own card: the line sits inside a drive card. */
  inline?: boolean;
}

/** "bisher 312.000 Dateien, 210 GB" (read at render time). */
export const soFarOf = (p: ScanProgress | null): string | undefined =>
  p ? t.disk.scan.soFar(formatCount(p.files), formatBytes(p.bytes)) : undefined;

/**
 * The one calm line about a scan: its state, what was counted so far (a new figure at most once
 * a second, see `PROGRESS_MS` in the store), Pause and Abbrechen while it runs, and a link where
 * the page is not the scan page. No bar, no percentage, no animation (FOCUS-GUIDELINES). One
 * element for the running and the ended scan, so the state changes inside a status region that
 * is already there; after the user's own Abbrechen the focus moves on to the link.
 */
export function ScanStatusLine({ state, detail, to, linkText, actions, inline = false }: Props) {
  const link = useRef<HTMLAnchorElement>(null);
  const cancelledHere = useRef(false);
  useEffect(() => {
    if (!actions && cancelledHere.current) {
      cancelledHere.current = false;
      link.current?.focus();
    }
  }, [actions]);
  const body = (
    <>
      <p className={styles.text}>
        <strong role="status">{state}</strong>
        {detail ? <span className={styles.muted}> · {detail}</span> : null}
        {to && linkText ? (
          <>
            <span className={styles.muted}> · </span>
            <Link ref={link} to={to} className={styles.link}>
              {linkText}
            </Link>
          </>
        ) : null}
      </p>
      {actions ? (
        <div className={styles.actions}>
          <Button onClick={actions.onPause}>
            <Icon name={actions.paused ? 'play' : 'pause'} size={18} />
            {actions.paused ? t.disk.scan.resume : t.disk.scan.pause}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              cancelledHere.current = true;
              actions.onCancel();
            }}
          >
            {t.disk.scan.cancel}
          </Button>
        </div>
      ) : null}
    </>
  );
  return inline ? (
    <div className={styles.inline} data-testid="scan-status">
      {body}
    </div>
  ) : (
    <Card as="div" className={styles.card} data-testid="scan-status">
      {body}
    </Card>
  );
}
