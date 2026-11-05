import type { DriveInfo } from '@/core/platform/disk';
import type { DiskIo } from '@/core/platform/system';
import { relativeDayLabel } from '@/core/time/dates';
import { pad2, toDateString, today } from '@/core/time/now';
import { t } from '@/strings';
import { Badge, Button, Card, HelpHint, Icon, Ring, Sparkline } from '@/ui';
import { percent } from '../format';
import {
  busLabel,
  driveType,
  fillLevel,
  formatCapacity,
  formatDelta,
  healthView,
} from '../logic/drives';
import { formatRate } from '../logic/system';
import { growthSinceScan, useDriveHistory } from '../history';
import { useDiskStore } from '../store';
import { ScanStatusLine, soFarOf } from './ScanStatusLine';
import styles from './DriveCard.module.css';

/** "Heute, 10:14" for the time of the last scan. */
function scanWhen(at: number): string {
  const d = new Date(at);
  return `${relativeDayLabel(toDateString(d), today())}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * One drive, calm: the ring, the name, one line of numbers, one line of advice and one muted line
 * of what it is. The module's scan shows its state here when it is this drive's (running, ended,
 * failed) instead of in a line above the grid. Health, temperature, the session history and the
 * live read/write rate wait behind "Details", so a page with four drives stays readable.
 */
export function DriveCard({
  drive: d,
  io,
  onScan,
}: {
  drive: DriveInfo;
  io?: DiskIo;
  onScan: () => void;
}) {
  const points = useDriveHistory((s) => s.points[d.root]);
  const lastScan = useDriveHistory((s) => s.lastScan[d.root]);
  // The module's one scan, only while it is this drive's.
  const phase = useDiskStore((s) => (s.root === d.root ? s.phase : 'idle'));
  const paused = useDiskStore((s) => s.root === d.root && s.paused);
  const progress = useDiskStore((s) => (s.root === d.root ? s.progress : null));
  const error = useDiskStore((s) => (s.root === d.root ? s.error : null));
  const cancelled = useDiskStore((s) => s.root === d.root && (s.summary?.cancelled ?? false));
  const cancel = useDiskStore((s) => s.cancel);
  const togglePause = useDiskStore((s) => s.togglePause);

  const used = Math.max(0, d.totalBytes - d.freeBytes);
  const pct = percent(used, d.totalBytes);
  const level = fillLevel(pct, d.freeBytes);
  const name = t.disk.driveName(d.root, d.label);
  const c = t.disk.card;
  const bus = busLabel(d.bus);
  const health = healthView(d.health);
  const growth = growthSinceScan(lastScan, points?.at(-1));
  const ioActive = io && (io.readBytesPerSec > 0 || io.writeBytesPerSec > 0);
  // What it is, in one muted line: model, type, interface where the type does not say it, file system.
  const kind = [
    d.model,
    c.type[driveType(d)],
    bus && bus !== 'USB' && bus !== 'NVMe' ? bus : null,
    d.fileSystem || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const scanning = phase === 'scanning';
  const scanLine = scanning ? (
    <ScanStatusLine
      inline
      state={paused ? t.disk.scan.paused : t.disk.scan.scanning}
      detail={soFarOf(progress)}
      to="/disk/scan"
      linkText={t.disk.scan.toScan}
      actions={{ paused, onPause: () => void togglePause(), onCancel: () => void cancel() }}
    />
  ) : phase === 'failed' ? (
    <ScanStatusLine
      inline
      state={t.disk.scan.failed(error ?? '')}
      to="/disk/scan"
      linkText={t.disk.scan.toScan}
    />
  ) : phase === 'done' ? (
    <ScanStatusLine
      inline
      state={cancelled ? t.disk.scan.cancelledShort : t.disk.scan.endedShort}
      to="/disk/scan"
      linkText={t.disk.scan.toResult}
    />
  ) : null;

  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <Ring percent={pct} level={level} label={name} />
        <div className={styles.head}>
          <h3 className={styles.name}>
            <span>{name}</span>
            {d.isSystem ? <Badge tone="accent">{c.systemDrive}</Badge> : null}
          </h3>
          <p className={styles.numbers}>
            {t.disk.usedOf(formatCapacity(used), formatCapacity(d.totalBytes))}
            <span className={styles.meta}> · {t.disk.free(formatCapacity(d.freeBytes))}</span>
          </p>
          <p className={styles.advice} data-level={level}>
            {level === 'full' ? <Icon name="alert" size={16} /> : null}
            {c.advice[level]}
          </p>
          {kind ? <p className={styles.meta}>{kind}</p> : null}
        </div>
      </div>

      {scanLine ?? (
        <p className={styles.meta}>
          {lastScan ? c.lastScan(scanWhen(lastScan.at)) : c.neverScanned}
          {growth !== null ? ` · ${c.growth(formatDelta(growth))}` : ''}
        </p>
      )}

      <div className={styles.foot}>
        {scanning ? null : (
          <Button variant="secondary" aria-label={t.disk.open(name)} onClick={onScan}>
            {c.scan}
          </Button>
        )}
        <details className={styles.details}>
          <summary className={styles.summary}>{c.details}</summary>
          <dl className={styles.facts}>
            <dt>
              {c.healthLabel} <HelpHint text={c.helpSmart} />
            </dt>
            <dd data-tone={health.tone}>{c.health[health.key]}</dd>
            {d.health.temperatureC != null ? (
              <>
                <dt>{c.temperatureLabel}</dt>
                <dd>{c.temperature(d.health.temperatureC)}</dd>
              </>
            ) : null}
            {points && points.length > 1 ? (
              <>
                <dt>{c.history}</dt>
                <dd className={styles.history}>
                  <Sparkline
                    values={points.map((p) => p.usedBytes)}
                    label={c.history}
                    width={120}
                  />
                  <span className={styles.meta}>{c.historyHint}</span>
                </dd>
              </>
            ) : null}
            {ioActive ? (
              <>
                <dt>{c.ioLabel}</dt>
                <dd>{c.io(formatRate(io.readBytesPerSec), formatRate(io.writeBytesPerSec))}</dd>
              </>
            ) : null}
          </dl>
        </details>
      </div>
    </Card>
  );
}
