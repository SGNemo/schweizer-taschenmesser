import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { EmptyState, Progress, Skeleton } from '@/ui';
import { formatBytes } from '../format';

/** Fill level of the drives (sizes only, no file or folder names, nothing from a scan). */
export default function DrivesWidget() {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
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
  const w = t.disk;
  const dw = t.diskWidget;
  if (failed) return <EmptyState compact title={dw.unavailable} />;
  if (!drives) return <Skeleton width="60%" height="1.25rem" />;
  if (drives.length === 0) return <EmptyState compact title={dw.empty} />;
  return (
    <div>
      <ul>
        {drives.map((d) => (
          <li key={d.root}>
            <p>{w.driveName(d.root, d.label)}</p>
            <Progress
              value={Math.max(0, d.totalBytes - d.freeBytes)}
              max={d.totalBytes}
              label={dw.free(formatBytes(d.freeBytes), formatBytes(d.totalBytes))}
            />
            <p>{dw.free(formatBytes(d.freeBytes), formatBytes(d.totalBytes))}</p>
          </li>
        ))}
      </ul>
      <Link to="/disk">{dw.open}</Link>
    </div>
  );
}
