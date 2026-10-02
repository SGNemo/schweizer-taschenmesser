import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DiskNode, PlaceSize } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Card, patternStyles } from '@/ui';
import { useDiskStore } from '../store';
import { formatBytes } from '../format';
import { formatCapacity } from '../logic/drives';
import styles from '../routes/DrivesPage.module.css';

/**
 * "Schnellübersicht": what can be tidied without a new scan – the known clean-up places with their
 * sizes, the recycle bin and the biggest folders of this session's last scan. Sizes are rough; the
 * way to delete stays the scan with its block list and confirmation.
 */
export function QuickOverview({ onScan }: { onScan: (path: string) => void }) {
  const [places, setPlaces] = useState<PlaceSize[] | null>(null);
  const [recycle, setRecycle] = useState<number | null>(null);
  const [biggest, setBiggest] = useState<DiskNode[]>([]);
  const scanId = useDiskStore((s) => s.scanId);
  const phase = useDiskStore((s) => s.phase);
  const rootNode = useDiskStore((s) => s.summary?.rootNode);

  useEffect(() => {
    let alive = true;
    const disk = getPlatform().disk;
    disk
      .placeSizes()
      .then((p) => alive && setPlaces(p))
      .catch(() => alive && setPlaces([]));
    disk
      .recycleSize()
      .then((b) => alive && setRecycle(b))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

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
  const hasPlaces = (places?.length ?? 0) > 0;
  if (!hasPlaces && recycle === null && biggest.length === 0) return null;
  const sizeText = (p: PlaceSize) =>
    p.partial ? q.atLeast(formatCapacity(p.sizeBytes)) : formatCapacity(p.sizeBytes);

  return (
    <section className={styles.places} aria-label={t.disk.places.title}>
      <h2>{q.title}</h2>
      <p className={styles.lead}>{q.lead}</p>
      <ul className={styles.grid}>
        {(places ?? []).map((p) => (
          <li key={p.path}>
            <Card className={styles.placeCard}>
              <span className={styles.name}>{t.disk.places.name[p.id]}</span>
              <span className={styles.size}>{sizeText(p)}</span>
              <span className={styles.path}>{p.path}</span>
              <span className={styles.meta}>{t.disk.places.hint[p.id]}</span>
              <Button variant="secondary" onClick={() => onScan(p.path)}>
                {t.disk.places.scan(t.disk.places.name[p.id]!)}
              </Button>
            </Card>
          </li>
        ))}
        {recycle !== null ? (
          <li>
            <Card className={styles.placeCard}>
              <span className={styles.name}>{q.recycle}</span>
              <span className={styles.size}>{formatCapacity(recycle)}</span>
              <span className={styles.meta}>{q.recycleHint}</span>
            </Card>
          </li>
        ) : null}
      </ul>
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
    </section>
  );
}
