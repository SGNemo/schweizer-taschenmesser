import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import type { DriveInfo } from '@/core/platform/disk';
import type { DiskIo } from '@/core/platform/system';
import { t } from '@/strings';
import { EmptyState, PageHeader, patternStyles, Segmented, Skeleton } from '@/ui';
import SystemTab from '../components/SystemTab';
import { DriveCard } from '../components/DriveCard';
import { QuickOverview } from '../components/QuickOverview';
import { ScanStatusLine, soFarOf } from '../components/ScanStatusLine';
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

/**
 * The module's scan while the user is on the drives page: running (Pause, Abbrechen, Zum Scan),
 * ended or cancelled (Zum Ergebnis), failed (the reason, Zum Scan). One `ScanStatusLine` in every
 * state, so the status text changes in place. Its own component, so the once-a-second figure
 * re-renders this line and not the drive cards. The line stays until the next scan starts: it is
 * the way back to the result.
 */
function ScanLine() {
  const phase = useDiskStore((s) => s.phase);
  const root = useDiskStore((s) => s.root);
  const progress = useDiskStore((s) => s.progress);
  const paused = useDiskStore((s) => s.paused);
  const error = useDiskStore((s) => s.error);
  const cancelled = useDiskStore((s) => s.summary?.cancelled ?? false);
  const cancel = useDiskStore((s) => s.cancel);
  const togglePause = useDiskStore((s) => s.togglePause);
  if (!root || phase === 'idle') return null;
  if (phase === 'scanning')
    return (
      <ScanStatusLine
        state={paused ? t.disk.scan.pausedOf(root) : t.disk.scan.runningOf(root)}
        detail={soFarOf(progress)}
        to="/disk/scan"
        linkText={t.disk.scan.toScan}
        actions={{ paused, onPause: () => void togglePause(), onCancel: () => void cancel() }}
      />
    );
  // Failed: there is no result, only the reason, and the scan page to try again.
  if (phase === 'failed')
    return (
      <ScanStatusLine
        state={t.disk.scan.failedOf(root)}
        detail={t.disk.scan.failed(error ?? '')}
        to="/disk/scan"
        linkText={t.disk.scan.toScan}
      />
    );
  return (
    <ScanStatusLine
      state={cancelled ? t.disk.scan.cancelledOf(root) : t.disk.scan.endedOf(root)}
      to="/disk/scan"
      linkText={t.disk.scan.toResult}
    />
  );
}

function DrivesTab() {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [io, setIo] = useState<DiskIo[]>([]);
  const navigate = useNavigate();
  const start = useDiskStore((s) => s.start);
  const scanning = useDiskStore((s) => s.phase === 'scanning');
  const scanRoot = useDiskStore((s) => s.root);
  const toast = useUiStore((s) => s.toast);
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

  const startScan = (root: string) => {
    if (scanning) {
      // A second scan would drop the running one: lead to it instead, nothing is lost.
      if (root !== scanRoot) toast(t.disk.scan.alreadyRunning);
      void navigate('/disk/scan');
      return;
    }
    void start(root);
    void navigate('/disk/scan');
  };

  return (
    <>
      <p className={styles.lead}>{t.disk.lead}</p>
      <ScanLine />
      {failed ? <p role="alert">{t.disk.failedDrives}</p> : null}
      {!drives && !failed ? (
        <div role="status" aria-label={t.disk.loading}>
          <Skeleton width="60%" height="1.25rem" />
        </div>
      ) : null}
      {drives && drives.length === 0 ? <EmptyState title={t.disk.empty} /> : null}
      {drives && drives.length > 0 ? (
        <ul className={styles.grid} aria-label={t.disk.tabs.drives}>
          {drives.map((d) => (
            <li key={d.root}>
              <DriveCard
                drive={d}
                io={io.find((x) => x.root === d.root)}
                onScan={() => startScan(d.root)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <QuickOverview onScan={startScan} />
    </>
  );
}
