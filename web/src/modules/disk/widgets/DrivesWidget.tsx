import { useEffect, useState } from 'react';
import { useLiveAttention } from '@/core/modules/liveAttention';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { FortschrittBody, WidgetBody } from '@/ui';
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
  // Identity v3.1 (G01): rings in the module hue; the state is a word in the line below the ring, never a ring colour.
  return (
    <WidgetBody
      loading={!drives && !failed}
      isEmpty={(drives ?? []).length === 0}
      empty={failed ? dw.unavailable : dw.empty}
    >
      <FortschrittBody
        kind="rings"
        // The widget shows 2 / 4 / 6 rings by size: the system drive first, then the fullest ones.
        entries={[...(drives ?? [])]
          .sort(
            (a, b) =>
              Number(b.isSystem) - Number(a.isSystem) ||
              percent(b.totalBytes - b.freeBytes, b.totalBytes) -
                percent(a.totalBytes - a.freeBytes, a.totalBytes),
          )
          .map((d) => {
            const used = Math.max(0, d.totalBytes - d.freeBytes);
            const level = fillLevel(percent(used, d.totalBytes), d.freeBytes);
            const free = t.disk.free(formatCapacity(d.freeBytes));
            const state = t.disk.head.state[level];
            return {
              key: d.root,
              title: d.root,
              value: used,
              max: d.totalBytes,
              detail: state ? `${free} · ${state}` : free,
            };
          })}
      />
    </WidgetBody>
  );
}
