import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import type { DiskIo } from '@/core/platform/system';
import { t } from '@/strings';
import { EmptyState, PageHeader, patternStyles, Segmented, Skeleton } from '@/ui';
import SystemTab from '../components/SystemTab';
import { DriveCard } from '../components/DriveCard';
import { QuickOverview } from '../components/QuickOverview';
import { useDriveHistory } from '../history';
import { useDiskStore } from '../store';
import styles from './DrivesPage.module.css';

/** Drives are re-read while the tab is open: the history and the live speed need fresh numbers. */
const REFRESH_MS = 5000;

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
  const [io, setIo] = useState<DiskIo[]>([]);
  const navigate = useNavigate();
  const start = useDiskStore((s) => s.start);
  const record = useDriveHistory((s) => s.record);

  useEffect(() => {
    let alive = true;
    const disk = getPlatform().disk;
    const system = getPlatform().system;
    const load = () => {
      if (document.hidden) return;
      disk
        .listDrives()
        .then((d) => {
          if (!alive) return;
          setDrives(d);
          record(d);
        })
        .catch(() => alive && setFailed(true));
      system
        .diskIo()
        .then((r) => alive && setIo(r))
        .catch(() => undefined);
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [record]);

  const scanRoot = (root: string) => {
    void start(root);
    void navigate('/disk/scan');
  };

  return (
    <>
      <p className={styles.lead}>{t.disk.lead}</p>
      {failed ? <p role="alert">{t.disk.failedDrives}</p> : null}
      {!drives && !failed ? (
        <div role="status" aria-label={t.disk.loading}>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {drives && drives.length === 0 ? <EmptyState icon="disk" title={t.disk.empty} /> : null}
      {drives && drives.length > 0 ? (
        <ul className={styles.grid} aria-label={t.disk.tabs.drives}>
          {drives.map((d) => (
            <li key={d.root}>
              <DriveCard
                drive={d}
                io={io.find((x) => x.root === d.root)}
                onScan={() => scanRoot(d.root)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <QuickOverview onScan={scanRoot} />
    </>
  );
}
