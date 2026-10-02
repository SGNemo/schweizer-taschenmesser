import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { SystemInfo } from '@/core/platform/system';
import { t } from '@/strings';
import { EmptyState, Progress, Skeleton } from '@/ui';
import { percent } from '../format';

const REFRESH_MS = 5000;

/** CPU, memory and battery in one glance; reads every few seconds while the page is visible. */
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
  if (failed && !info) return <EmptyState compact icon="cpu" title={w.unavailable} />;
  if (!info) return <Skeleton width="60%" height="1.25rem" />;
  const ram = percent(info.memory.usedBytes, info.memory.totalBytes);
  const cpu = Math.round(info.cpu.usagePercent);
  const bat = info.battery?.percent;
  return (
    <div>
      <Progress value={cpu} max={100} label={`${w.cpu} ${cpu} %`} />
      <p>{`${w.cpu} ${cpu} %`}</p>
      <Progress value={ram} max={100} label={`${w.ram} ${ram} %`} />
      <p>{`${w.ram} ${ram} %`}</p>
      {bat != null ? (
        <p>{`${w.battery} ${Math.round(bat)} %${info.battery?.charging ? ` · ${w.charging}` : ''}`}</p>
      ) : null}
      <Link to="/disk?tab=system">{w.open}</Link>
    </div>
  );
}
