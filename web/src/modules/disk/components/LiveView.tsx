import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { Segmented } from '@/ui';
import { formatBytes, formatCount } from '../format';
import { minBytesFor, sortNodes } from '../logic/tree';
import { LIVE_POLL_MS, useDiskStore } from '../store';
import { Legend } from './Legend';
import { NodeList } from './NodeList';
import { TreemapView } from './TreemapView';
import palette from './Palette.module.css';
import styles from './LiveView.module.css';

const noop = () => undefined;

/**
 * What a running scan has found so far: the top folder levels as a map or a list, growing in calm
 * steps (one poll every `LIVE_POLL_MS` while this view is open; the store keeps the last picture,
 * so leaving the page and coming back shows it at once). View only – opening, selecting and
 * deleting come with the finished scan. Folders still being counted say so in text (an ellipsis
 * on the map, a note in the list) and with a dashed outline, never by colour alone. The list keeps
 * a stable order (by name) while sizes still move.
 */
export function LiveView({ scanId }: { scanId: number }) {
  const live = useDiskStore((s) => s.live);
  const pollLive = useDiskStore((s) => s.pollLive);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onSize = useCallback((w: number, h: number) => {
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  const root = live[0];
  // What the canvas can show decides how small an entry is worth fetching. The next poll reads
  // the current value from a ref; a growing total must not restart the interval.
  const minBytes = root ? minBytesFor(root.bytes, size.w, size.h) : 0;
  const wanted = useRef(minBytes);
  useEffect(() => {
    wanted.current = minBytes;
  }, [minBytes]);

  useEffect(() => {
    const tick = () => void pollLive(wanted.current);
    tick();
    const id = setInterval(tick, LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [scanId, pollLive]);

  const topLevel = useMemo(
    () =>
      root
        ? sortNodes(
            live.filter((n) => n.parentId === root.id),
            'name',
            'asc',
          )
        : [],
    [live, root],
  );
  // The map's name counts the top-level tiles, so the pending note counts the same entries.
  const pendingTop = useMemo(() => topLevel.filter((n) => n.pending).length, [topLevel]);
  const mapLabel = `${t.disk.scan.liveMapLabel(topLevel.length)}${
    pendingTop > 0 ? ` ${t.disk.scan.pendingCount(pendingTop)}` : ''
  }`;
  const pendingNote = useCallback(
    (n: DiskNode) => (n.pending ? t.disk.scan.pendingShort : undefined),
    [],
  );
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
        {n.pending ? <p className={styles.pending}>{t.disk.scan.pendingNote}</p> : null}
      </>
    ),
    [],
  );

  return (
    <section className={`${palette.palette} ${styles.live}`} aria-label={t.disk.scan.liveLabel}>
      <Segmented
        label={t.disk.views.label}
        value={view}
        options={[
          { value: 'map', label: t.disk.views.map },
          { value: 'list', label: t.disk.views.list },
        ]}
        onChange={setView}
      />
      {!root ? (
        <p className={styles.waiting} role="status">
          {t.disk.scan.liveEmpty}
        </p>
      ) : view === 'map' ? (
        <>
          <TreemapView
            root={root}
            nodes={live.slice(1)}
            colorBy="age"
            selectedId={null}
            onSize={onSize}
            onZoom={noop}
            onSelect={noop}
            onUp={noop}
            tooltip={tooltip}
            emptyText={t.disk.scan.liveEmpty}
            ariaLabel={mapLabel}
            testId="live-map"
          />
          <Legend colorBy="age" />
        </>
      ) : (
        <NodeList
          nodes={topLevel}
          total={root.bytes}
          selectedId={null}
          note={pendingNote}
          label={t.disk.scan.liveList}
        />
      )}
      <p className={styles.hint} id="disk-map-help">
        {view === 'map' && root ? `${t.disk.scan.pendingLegend} · ` : ''}
        {t.disk.scan.liveHint}
      </p>
    </section>
  );
}
