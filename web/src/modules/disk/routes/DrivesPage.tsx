import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DriveInfo, Place } from '@/core/platform/disk';
import { t } from '@/strings';
import { Badge, Button, Card, EmptyState, PageHeader, patternStyles, Segmented } from '@/ui';
import SystemTab from '../components/SystemTab';
import { UsageRing } from '../components/UsageRing';
import { driveLevel, formatBytes, percent } from '../format';
import { useDiskStore } from '../store';
import styles from './DrivesPage.module.css';

const kindLabel = (d: DriveInfo): string =>
  d.kind === 'fixed' && d.media !== 'unknown' ? t.disk.kind[d.media] : t.disk.kind[d.kind];

const TABS = ['drives', 'system'] as const;
type Tab = (typeof TABS)[number];

/** "Dieser PC": tab Laufwerke (scan entry) and tab System (live facts), selected via `?tab=`. */
export default function ThisPcPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.find((k) => k === raw) ?? 'drives';
  return (
    <>
      <PageHeader title={t.disk.title} />
      <div className={patternStyles.gapBottom}>
        <Segmented
          label={t.disk.tabsLabel}
          value={tab}
          options={TABS.map((k) => ({ value: k, label: t.disk.tabs[k] }))}
          onChange={(k) => setParams(k === 'drives' ? {} : { tab: k }, { replace: true })}
        />
      </div>
      {tab === 'system' ? <SystemTab /> : <DrivesTab />}
    </>
  );
}

function DrivesTab() {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const navigate = useNavigate();
  const start = useDiskStore((s) => s.start);

  useEffect(() => {
    let alive = true;
    getPlatform()
      .disk.listDrives()
      .then((d) => alive && setDrives(d))
      .catch(() => alive && setFailed(true));
    getPlatform()
      .disk.knownPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const scanRoot = (root: string) => {
    void start(root);
    void navigate('/disk/scan');
  };
  const open = (d: DriveInfo) => scanRoot(d.root);

  return (
    <>
      <p className={styles.lead}>{t.disk.lead}</p>
      {failed ? <p role="alert">{t.disk.failedDrives}</p> : null}
      {!drives && !failed ? <p aria-live="polite">{t.disk.loading}</p> : null}
      {drives && drives.length === 0 ? <EmptyState title={t.disk.empty} /> : null}
      {drives && drives.length > 0 ? (
        <ul className={styles.grid} aria-label={t.disk.tabs.drives}>
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
      {places.length > 0 ? (
        <section className={styles.places} aria-label={t.disk.places.title}>
          <h2>{t.disk.places.title}</h2>
          <p className={styles.lead}>{t.disk.places.lead}</p>
          <ul className={styles.grid}>
            {places.map((p) => (
              <li key={p.path}>
                <Card className={styles.placeCard}>
                  <span className={styles.name}>{t.disk.places.name[p.id]}</span>
                  <span className={styles.path}>{p.path}</span>
                  <span className={styles.meta}>{t.disk.places.hint[p.id]}</span>
                  <Button onClick={() => scanRoot(p.path)}>
                    {t.disk.places.scan(t.disk.places.name[p.id]!)}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
