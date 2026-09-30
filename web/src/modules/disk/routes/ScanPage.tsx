import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Card, HelpHint, Icon, PageHeader, Stat } from '@/ui';
import { formatBytes, formatCount, formatDuration, percent } from '../format';
import { useDiskStore } from '../store';
import styles from './ScanPage.module.css';

function Running() {
  const { progress, paused, cancel, togglePause } = useDiskStore();
  return (
    <Card>
      <p aria-live="polite" className={styles.status}>
        {paused ? t.disk.scan.paused : t.disk.scan.scanning}
      </p>
      <progress className={styles.bar} aria-label={t.disk.scan.scanning} />
      <div className={styles.stats}>
        <Stat
          label={t.disk.scan.files}
          value={formatCount(progress?.files ?? 0)}
          testId="scan-files"
        />
        <Stat label={t.disk.scan.folders} value={formatCount(progress?.dirs ?? 0)} />
        <Stat label={t.disk.scan.used} value={formatBytes(progress?.bytes ?? 0)} />
      </div>
      {progress?.current ? (
        <p className={styles.current} title={progress.current}>
          <span className={styles.muted}>{t.disk.scan.current}: </span>
          {progress.current}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button onClick={() => void togglePause()}>
          <Icon name={paused ? 'play' : 'pause'} size={18} />
          {paused ? t.disk.scan.resume : t.disk.scan.pause}
        </Button>
        <Button variant="danger" onClick={() => void cancel()}>
          {t.disk.scan.cancel}
        </Button>
      </div>
    </Card>
  );
}

function Result() {
  const summary = useDiskStore((s) => s.summary)!;
  const [top, setTop] = useState<DiskNode[]>([]);

  useEffect(() => {
    let alive = true;
    void getPlatform()
      .disk.children(summary.scanId, summary.rootNode.id, 1, 0)
      .then((n) => alive && setTop(n.slice(0, 30)));
    return () => {
      alive = false;
    };
  }, [summary]);

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
      <Card title={t.disk.scan.topFolders}>
        <ul className={styles.rows}>
          {top.map((n) => (
            <li key={n.id} className={styles.row}>
              <span className={styles.rowName}>
                {n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name}
              </span>
              <span className={styles.rowBar} aria-hidden="true">
                <span style={{ width: `${percent(n.bytes, summary.bytes)}%` }} />
              </span>
              <span className={styles.rowSize}>{formatBytes(n.bytes)}</span>
            </li>
          ))}
        </ul>
      </Card>
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
