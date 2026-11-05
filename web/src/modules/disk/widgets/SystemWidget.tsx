import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { SystemInfo } from '@/core/platform/system';
import { t } from '@/strings';
import { EmptyState, FortschrittBody, Skeleton, StatusWidget } from '@/ui';
import { percent } from '../format';

const REFRESH_MS = 5000;

/** CPU and memory as small rings plus the battery; reads every few seconds while the page is visible. */
export default function SystemWidget() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      getPlatform()
        .system.info()
        .then((i) => alive && (setInfo(i), setFailed(false)))
        .catch(() => alive && setFailed(true));
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const w = t.systemWidget;
  if (failed && !info) return <EmptyState compact title={w.unavailable} />;
  if (!info) return <Skeleton width="60%" height="1.25rem" />;
  const ram = percent(info.memory.usedBytes, info.memory.totalBytes);
  const cpu = Math.round(info.cpu.usagePercent);
  const bat = info.battery?.percent;
  // Identity v3.1 (G01): rings in the module hue; a high load is said in words, not in a ring colour.
  const ring = (key: string, title: string, value: number) => ({
    key,
    title,
    value,
    max: 100,
    detail: value >= 90 ? w.high : w.normal,
  });
  return (
    <div>
      <FortschrittBody kind="rings" entries={[ring('cpu', w.cpu, cpu), ring('ram', w.ram, ram)]} />
      {bat != null ? (
        <StatusWidget
          icon="battery"
          state={`${w.battery} ${Math.round(bat)} %${info.battery?.charging ? ` · ${w.charging}` : ''}`}
        />
      ) : null}
    </div>
  );
}
