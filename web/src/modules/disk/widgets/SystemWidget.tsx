import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { SystemInfo } from '@/core/platform/system';
import { t } from '@/strings';
import { EmptyState, Ring, Skeleton, StatusWidget } from '@/ui';
import { percent } from '../format';
import styles from './SystemWidget.module.css';

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
  if (failed && !info) return <EmptyState compact icon="cpu" title={w.unavailable} />;
  if (!info) return <Skeleton width="60%" height="1.25rem" />;
  const ram = percent(info.memory.usedBytes, info.memory.totalBytes);
  const cpu = Math.round(info.cpu.usagePercent);
  const bat = info.battery?.percent;
  return (
    <div>
      <div className={styles.rings}>
        <div className={styles.ring}>
          <Ring percent={cpu} level={cpu >= 90 ? 'full' : 'ok'} label={w.cpu} />
          <span>{w.cpu}</span>
        </div>
        <div className={styles.ring}>
          <Ring percent={ram} level={ram >= 90 ? 'full' : 'ok'} label={w.ram} />
          <span>{w.ram}</span>
        </div>
      </div>
      {bat != null ? (
        <StatusWidget
          icon="battery"
          state={`${w.battery} ${Math.round(bat)} %${info.battery?.charging ? ` · ${w.charging}` : ''}`}
        />
      ) : null}
    </div>
  );
}
