import { Link, Navigate } from 'react-router';
import { t } from '@/strings';
import { Card, HelpHint, PageHeader, Stat } from '@/ui';
import { LiveView } from '../components/LiveView';
import { ScanStatusLine } from '../components/ScanStatusLine';
import { ScanView } from '../components/ScanView';
import { formatBytes, formatCount, formatDuration } from '../format';
import { useDiskStore } from '../store';
import styles from './ScanPage.module.css';

/**
 * A running scan: one calm status line (Pause, Abbrechen) and the growing live picture. Only the
 * fields shown are subscribed, so the ten progress events a second from Rust do not re-render
 * the page (the store passes one on at most every second anyway).
 */
function Running() {
  const progress = useDiskStore((s) => s.progress);
  const paused = useDiskStore((s) => s.paused);
  const scanId = useDiskStore((s) => s.scanId);
  const cancel = useDiskStore((s) => s.cancel);
  const togglePause = useDiskStore((s) => s.togglePause);
  return (
    <>
      <ScanStatusLine
        progress={progress}
        paused={paused}
        onPause={() => void togglePause()}
        onCancel={() => void cancel()}
      />
      {scanId !== null ? <LiveView scanId={scanId} /> : null}
    </>
  );
}

function Result() {
  const summary = useDiskStore((s) => s.summary)!;
  return (
    <>
      {summary.cancelled ? <p role="status">{t.disk.scan.cancelled}</p> : null}
      <Card>
        <div className={styles.stats}>
          <Stat
            label={t.disk.scan.totalUsed}
            value={formatBytes(summary.bytes)}
            testId="scan-total"
          />
          <Stat label={t.disk.scan.fileSize} value={formatBytes(summary.logicalBytes)} />
          <Stat label={t.disk.scan.files} value={formatCount(summary.files)} />
          <Stat label={t.disk.scan.folders} value={formatCount(summary.dirs)} />
        </div>
        <p className={styles.muted}>
          {t.disk.scan.duration(formatDuration(summary.elapsedMs))}{' '}
          <HelpHint text={t.disk.scan.sizeHelp} />
        </p>
        {summary.cloudBytes > 0 ? (
          <p className={styles.muted}>{t.disk.scan.cloud(formatBytes(summary.cloudBytes))}</p>
        ) : null}
        {summary.skippedLinks > 0 ? (
          <p className={styles.muted}>{t.disk.scan.links(summary.skippedLinks)}</p>
        ) : null}
      </Card>
      <ScanView summary={summary} />
      {summary.notReadTotal > 0 ? (
        <Card title={t.disk.scan.notRead}>
          <p className={styles.muted}>{t.disk.scan.notReadHint}</p>
          <ul className={styles.notRead} data-testid="not-read">
            {summary.notRead.slice(0, 50).map((n) => (
              <li key={n.path}>
                <code>{n.path}</code> – {t.disk.scan.reason[n.reason]}
              </li>
            ))}
          </ul>
          {summary.notReadTotal > 50 ? (
            <p className={styles.muted}>{t.disk.scan.notReadMore(summary.notReadTotal - 50)}</p>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

export default function ScanPage() {
  const phase = useDiskStore((s) => s.phase);
  const root = useDiskStore((s) => s.root);
  const error = useDiskStore((s) => s.error);
  if (phase === 'idle' || !root) return <Navigate to="/disk" replace />;
  return (
    <>
      <PageHeader title={t.disk.scan.title(root)}>
        <Link to="/disk" className={styles.back}>
          {t.disk.scan.back}
        </Link>
      </PageHeader>
      {phase === 'scanning' ? <Running /> : null}
      {phase === 'failed' ? <p role="alert">{t.disk.scan.failed(error ?? '')}</p> : null}
      {phase === 'done' ? <Result /> : null}
    </>
  );
}
