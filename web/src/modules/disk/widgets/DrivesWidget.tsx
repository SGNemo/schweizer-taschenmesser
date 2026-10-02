import { useEffect, useState } from 'react';
import { useLiveAttention } from '@/core/modules/liveAttention';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { GaugeList } from '@/ui';
import { percent } from '../format';
import { driveAttention } from '../logic/attention';
import { fillLevel, formatCapacity } from '../logic/drives';

const SOURCE = 'disk:drives';
/** Drives change slowly; a minute is plenty for the home screen. */
const REFRESH_MS = 60_000;

/** Fill level of the drives (sizes only, no file or folder names, nothing from a scan). */
export default function DrivesWidget() {
  const [drives, setDrives] = useState<DriveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      getPlatform()
        .disk.listDrives()
        .then((d) => {
          if (!alive) return;
          setDrives(d);
          useLiveAttention.getState().publish(SOURCE, driveAttention(d));
        })
        .catch(() => alive && setFailed(true));
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
      useLiveAttention.getState().clear(SOURCE);
    };
  }, []);
  const dw = t.diskWidget;
  return (
    <GaugeList
      loading={!drives && !failed}
      empty={failed ? dw.unavailable : dw.empty}
      entries={(drives ?? []).map((d) => {
        const used = Math.max(0, d.totalBytes - d.freeBytes);
        const pct = percent(used, d.totalBytes);
        const level = fillLevel(pct, d.freeBytes);
        return {
          key: d.root,
          name: t.disk.driveName(d.root, d.label),
          percent: pct,
          level,
          detail: dw.free(formatCapacity(d.freeBytes), formatCapacity(d.totalBytes)),
          hint: t.disk.card.advice[level],
        };
      })}
    />
  );
}
