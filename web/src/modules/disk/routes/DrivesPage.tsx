import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { Badge, Card, EmptyState, PageHeader } from '@/ui';
import { UsageRing } from '../components/UsageRing';
import { driveLevel, formatBytes, percent } from '../format';
import { useDiskStore } from '../store';
import styles from './DrivesPage.module.css';

const kindLabel = (d: DriveInfo): string =>
  d.kind === 'fixed' && d.media !== 'unknown' ? t.disk.kind[d.media] : t.disk.kind[d.kind];

export default function DrivesPage() {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const start = useDiskStore((s) => s.start);

  useEffect(() => {
    let alive = true;
    getPlatform()
      .disk.listDrives()
      .then((d) => alive && setDrives(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const open = (d: DriveInfo) => {
    void start(d.root);
    void navigate('/disk/scan');
  };

  return (
    <>
      <PageHeader title={t.disk.title} />
      <p className={styles.lead}>{t.disk.lead}</p>
      {failed ? <p role="alert">{t.disk.failedDrives}</p> : null}
      {!drives && !failed ? <p aria-live="polite">{t.disk.loading}</p> : null}
      {drives && drives.length === 0 ? <EmptyState icon="disk" title={t.disk.empty} /> : null}
      {drives && drives.length > 0 ? (
        <ul className={styles.grid} aria-label={t.disk.title}>
          {drives.map((d) => {
            const used = Math.max(0, d.totalBytes - d.freeBytes);
            const pct = percent(used, d.totalBytes);
            const level = driveLevel(pct);
            const name = t.disk.driveName(d.root, d.label);
            return (
              <li key={d.root}>
                <Card className={styles.card}>
                  <button
                    type="button"
                    className={styles.open}
                    aria-label={t.disk.open(name)}
                    onClick={() => open(d)}
                  >
                    <UsageRing percent={pct} />
                    <span className={styles.text}>
                      <span className={styles.name}>{name}</span>
                      <span className={styles.meta}>
                        {kindLabel(d)}
                        {d.fileSystem ? ` · ${d.fileSystem}` : ''}
                      </span>
                      <span>{t.disk.usedOf(formatBytes(used), formatBytes(d.totalBytes))}</span>
                      <span className={styles.meta}>{t.disk.free(formatBytes(d.freeBytes))}</span>
                      {level !== 'ok' ? (
                        <span>
                          <Badge tone={level === 'full' ? 'accent' : 'neutral'}>
                            {level === 'full' ? t.disk.almostFull : t.disk.getting}
                          </Badge>
                        </span>
                      ) : null}
                    </span>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
