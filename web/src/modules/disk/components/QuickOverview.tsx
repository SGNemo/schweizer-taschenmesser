import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { Card, patternStyles } from '@/ui';
import { useDiskStore } from '../store';
import { formatBytes } from '../format';
import styles from '../routes/DrivesPage.module.css';

/**
 * Below the drives: the pointer to the tab "Aufräumen" (which took over the list of clean-up
 * places and the recycle bin) and the biggest folders of this session's last scan.
 */
export function QuickOverview() {
  const [biggest, setBiggest] = useState<DiskNode[]>([]);
  const scanId = useDiskStore((s) => s.scanId);
  const phase = useDiskStore((s) => s.phase);
  const rootNode = useDiskStore((s) => s.summary?.rootNode);

  useEffect(() => {
    let alive = true;
    if (scanId === null || phase !== 'done' || !rootNode) return;
    getPlatform()
      .disk.children(scanId, rootNode.id, 1, 0)
      .then((list) => {
        if (!alive) return;
        const dirs = list.filter((n) => n.kind === 'dir' && n.name);
        setBiggest([...dirs].sort((a, b) => b.bytes - a.bytes).slice(0, 5));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [scanId, phase, rootNode]);

  const q = t.disk.quick;
  return (
    <div className={styles.places}>
      {/* A sentence, no button: the tab is right above (one action less on the first screen). */}
      <p className={styles.pointer}>{t.disk.tidy.pointer}</p>
      {biggest.length > 0 ? (
        <Card title={q.biggest} className={styles.biggest}>
          <p className={styles.meta}>{q.biggestHint}</p>
          <ul className={patternStyles.plainList}>
            {biggest.map((n) => (
              <li key={n.id} className={styles.biggestRow}>
                <span>{n.name}</span>
                <span className={styles.meta}>{formatBytes(n.bytes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
