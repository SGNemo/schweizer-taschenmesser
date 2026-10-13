import { useCallback, useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { formatBytes, formatCount } from '../format';
import { minBytesFor } from '../logic/tree';
import { Legend } from './Legend';
import { TreemapView } from './TreemapView';
import palette from './Palette.module.css';
import styles from './LiveMap.module.css';

/** How often the running scan is asked for its growing picture. */
const POLL_MS = 500;
const noop = () => undefined;

/**
 * The map of a running scan: the top folder levels fill up while the native side counts, so the
 * page is never empty. View only – opening, selecting and deleting come with the finished scan.
 */
export function LiveMap({ scanId }: { scanId: number }) {
  const [nodes, setNodes] = useState<DiskNode[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onSize = useCallback((w: number, h: number) => {
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  const root = nodes[0];
  const minBytes = root ? minBytesFor(root.bytes, size.w, size.h) : 0;

  useEffect(() => {
    let alive = true;
    const disk = getPlatform().disk;
    const load = () =>
      disk
        .liveScan(scanId, minBytes)
        .then((n) => alive && setNodes(n))
        .catch(() => undefined);
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [scanId, minBytes]);

  const tooltip = useCallback(
    (n: DiskNode) => (
      <>
        <strong>{n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name}</strong>
        <dl>
          <dt>{t.disk.details.used}</dt>
          <dd>{formatBytes(n.bytes)}</dd>
          <dt>{t.disk.details.files}</dt>
          <dd>{formatCount(n.files)}</dd>
        </dl>
      </>
    ),
    [],
  );

  return (
    <section className={`${palette.palette} ${styles.live}`} aria-label={t.disk.scan.liveLabel}>
      <p className={styles.hint} id="disk-live-help">
        {t.disk.scan.liveHint}
      </p>
      {root ? (
        <TreemapView
          root={root}
          nodes={nodes.slice(1)}
          colorBy="age"
          selectedId={null}
          onSize={onSize}
          onZoom={noop}
          onSelect={noop}
          onUp={noop}
          tooltip={tooltip}
          emptyText={t.disk.scan.liveEmpty}
          testId="live-map"
        />
      ) : (
        <p className={styles.waiting} role="status">
          {t.disk.scan.liveEmpty}
        </p>
      )}
      <Legend colorBy="age" />
    </section>
  );
}
