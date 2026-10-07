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
import styles from './DriveCard.module.css';

/** "Heute, 10:14" for the time of the last scan. */
function scanWhen(at: number): string {
  const d = new Date(at);
  return `${relativeDayLabel(toDateString(d), today())}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** One drive in plain words: what it is, how full, what to do, how healthy, how it changed. */
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
  const scan = useDriveHistory((s) => s.lastScan[d.root]);
  const used = Math.max(0, d.totalBytes - d.freeBytes);
  const pct = percent(used, d.totalBytes);
  const level = fillLevel(pct, d.freeBytes);
  const name = t.disk.driveName(d.root, d.label);
  const c = t.disk.card;
  const bus = busLabel(d.bus);
  const health = healthView(d.health);
  const growth = growthSinceScan(scan, points?.at(-1));
  const ioActive = io && (io.readBytesPerSec > 0 || io.writeBytesPerSec > 0);

  return (
    <Card className={styles.card}>
      <div className={styles.top}>
        <Ring percent={pct} level={level} label={name} />
        <div className={styles.head}>
          <h3 className={styles.name}>{name}</h3>
          <div className={styles.chips}>
            <Badge>{c.type[driveType(d)]}</Badge>
            {bus && bus !== 'USB' && bus !== 'NVMe' ? <Badge>{bus}</Badge> : null}
            {d.fileSystem ? <Badge>{d.fileSystem}</Badge> : null}
            {d.isSystem ? <Badge tone="accent">{c.systemDrive}</Badge> : null}
          </div>
          {d.model ? <p className={styles.meta}>{d.model}</p> : null}
        </div>
      </div>

      <p className={styles.numbers}>
        {t.disk.usedOf(formatCapacity(used), formatCapacity(d.totalBytes))}
        <span className={styles.meta}>
          {' '}
          · {t.disk.percentUsed(pct)} · {t.disk.free(formatCapacity(d.freeBytes))}
        </span>
      </p>
      <p className={styles.advice} data-level={level}>
        {level === 'full' ? <Icon name="alert" size={16} /> : null}
        {c.advice[level]}
      </p>

      <dl className={styles.facts}>
        <dt>
          {c.healthLabel} <HelpHint text={c.helpSmart} />
        </dt>
        <dd data-tone={health.tone}>
          {c.health[health.key]}
          {d.health.temperatureC != null ? ` · ${c.temperature(d.health.temperatureC)}` : ''}
        </dd>
      </dl>

      {points && points.length > 1 ? (
        <div className={styles.history}>
          <Sparkline values={points.map((p) => p.usedBytes)} label={c.history} width={120} />
          <span className={styles.meta}>{c.historyHint}</span>
        </div>
      ) : null}
      <p className={styles.meta}>
        {scan ? c.lastScan(scanWhen(scan.at)) : c.neverScanned}
        {growth !== null ? ` · ${c.growth(formatDelta(growth))}` : ''}
      </p>
      {ioActive ? (
        <p className={styles.meta}>
          {c.io(formatRate(io.readBytesPerSec), formatRate(io.writeBytesPerSec))}
        </p>
      ) : null}

      <Button variant="secondary" aria-label={t.disk.open(name)} onClick={onScan}>
        {c.scan}
      </Button>
    </Card>
  );
}
