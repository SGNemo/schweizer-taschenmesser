import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import type { CareTool, CleanupPlace } from '@/core/platform/optimize';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, Checkbox, EmptyState } from '@/ui';
import { useCleanupStore } from '../cleanupStore';
import { formatBytes } from '../format';
import {
  restBytes,
  restIds,
  restSelected,
  selectedBytes,
  selectedIds,
  totalBytes,
  type Selection,
} from '../logic/cleanup';
import { DeleteDialog } from './DeleteDialog';
import styles from './CleanupTab.module.css';

const day = (sec: number): string =>
  sec > 0 ? formatTimestamp(sec * 1000, { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';

const nameOf = (p: CleanupPlace): string =>
  t.disk.tidy.placeName(t.disk.tidy.category[p.category]!, t.disk.tidy.source[p.source] ?? '');

interface Props {
  /** "Genauer ansehen": the ordinary scan of that folder. */
  onScan: (path: string) => void;
  /** To the drives tab (duplicates and large old files live in a drive's scan). */
  onDrives: () => void;
}

/**
 * Tab "Aufräumen": looks through the well-known clean-up places on request and lists what could
 * go, with size and a preview. Nothing here deletes: "Aufräumen …" opens the one delete dialog
 * with the ticked node ids (block list, recycle bin by default, second confirmation natively).
 * What Windows handles more safely itself (recycle bin, update leftovers) is only linked.
 */
export function CleanupTab({ onScan, onDrives }: Props) {
  const phase = useCleanupStore((s) => s.phase);
  const progress = useCleanupStore((s) => s.progress);
  const places = useCleanupStore((s) => s.places);
  const cancelled = useCleanupStore((s) => s.cancelled);
  const search = useCleanupStore((s) => s.search);
  const cancel = useCleanupStore((s) => s.cancel);
  const refresh = useCleanupStore((s) => s.refresh);
  const [deleting, setDeleting] = useState<{ scanId: number; ids: number[] } | null>(null);
  const x = t.disk.tidy;

  const status =
    phase === 'searching'
      ? progress
        ? x.searchingStep(progress.done + 1, progress.total, x.category[progress.category]!)
        : x.searching
      : phase === 'failed'
        ? x.failed
        : phase === 'done' && places.length > 0
          ? x.summary(places.length, formatBytes(totalBytes(places)))
          : '';

  return (
    <div className={styles.tab}>
      <p className={styles.lead}>{x.lead}</p>
      <div className={styles.bar}>
        {/* One status region for searching, the result figure and a failure: it changes in place. */}
        <p className={styles.status} role="status">
          {status}
        </p>
        {phase === 'searching' ? (
          <Button onClick={() => void cancel()}>{x.cancel}</Button>
        ) : (
          <Button
            variant={phase === 'idle' ? 'primary' : 'secondary'}
            onClick={() => void search()}
          >
            {phase === 'idle' ? x.search : x.again}
          </Button>
        )}
      </div>
      {phase === 'done' && cancelled ? <p className={styles.note}>{x.cancelledNote}</p> : null}
      {phase === 'done' && places.length === 0 && !cancelled ? (
        <EmptyState title={x.none}>
          <p>{x.noneHint}</p>
          <Button onClick={onDrives}>{x.toDrives}</Button>
        </EmptyState>
      ) : null}
      {places.length > 0 ? (
        <ul className={styles.list} aria-label={x.listLabel}>
          {places.map((p) => (
            <li key={p.scanId}>
              <Suggestion
                place={p}
                onClean={(ids) => setDeleting({ scanId: p.scanId, ids })}
                onScan={() => onScan(p.path)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <WindowsTools />
      {deleting ? (
        <DeleteDialog
          key={`${deleting.scanId}:${deleting.ids.join(',')}`}
          scanId={deleting.scanId}
          nodeIds={deleting.ids}
          onClose={(changed) => {
            const { scanId } = deleting;
            setDeleting(null);
            if (changed) void refresh(scanId);
          }}
        />
      ) : null}
    </div>
  );
}

const EMPTY: Selection = new Set();

/** One suggestion: what it is, how much, the preview with ticks, and the two ways on. */
function Suggestion({
  place,
  onClean,
  onScan,
}: {
  place: CleanupPlace;
  onClean: (ids: number[]) => void;
  onScan: () => void;
}) {
  const selection = useCleanupStore((s) => s.selection[place.scanId]) ?? EMPTY;
  const toggle = useCleanupStore((s) => s.toggle);
  const toggleRest = useCleanupStore((s) => s.toggleRest);
  const toggleAll = useCleanupStore((s) => s.toggleAll);
  const x = t.disk.tidy;
  const name = nameOf(place);
  const ids = selectedIds(place, selection);
  const rest = restIds(place);
  const allTicked = ids.length === place.ids.length;
  return (
    <Card as="div" className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.name}>{name}</h2>
        <span className={styles.size}>{formatBytes(place.totalBytes)}</span>
      </div>
      <p className={styles.muted}>{x.what[place.category]}</p>
      {place.busy ? <p className={styles.note}>{x.busy(x.source[place.source] ?? name)}</p> : null}
      <details className={styles.preview} open={!place.preselected || place.busy}>
        <summary>{x.preview(place.ids.length)}</summary>
        <Button size="sm" variant="ghost" onClick={() => toggleAll(place.scanId, !allTicked)}>
          {allTicked ? x.noneSelected : x.all}
        </Button>
        <ul className={styles.items}>
          {place.items.map((n) => (
            <li key={n.id} className={styles.item}>
              <Checkbox
                label={x.selectItem(n.name)}
                labelHidden
                checked={selection.has(n.id)}
                onChange={() => toggle(place.scanId, n.id)}
              />
              <span className={styles.itemName} title={n.name}>
                {n.name}
              </span>
              <span className={styles.itemMeta}>
                {n.modified > 0 ? x.changed(day(n.modified)) : ''}
              </span>
              <span className={styles.itemSize}>{formatBytes(n.bytes)}</span>
            </li>
          ))}
          {rest.length > 0 ? (
            <li className={styles.item}>
              <Checkbox
                label={x.rest(rest.length, formatBytes(restBytes(place)))}
                checked={restSelected(place, selection)}
                onChange={(e) => toggleRest(place.scanId, e.currentTarget.checked)}
              />
            </li>
          ) : null}
        </ul>
      </details>
      <div className={styles.foot}>
        <span className={styles.selected}>
          {ids.length > 0
            ? x.selected(formatBytes(selectedBytes(place, selection)))
            : x.nothingSelected}
        </span>
        <div className={styles.actions}>
          <Button variant="ghost" aria-label={x.lookLabel(name)} onClick={onScan}>
            {x.look}
          </Button>
          <Button
            aria-label={x.cleanLabel(name)}
            disabled={ids.length === 0}
            onClick={() => onClean(ids)}
          >
            {x.clean}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** What Windows tidies up itself: the page only opens the right place (fixed list, checked natively). */
function WindowsTools() {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [recycle, setRecycle] = useState<number | null>(null);
  const w = t.disk.tidy.windows;

  useEffect(() => {
    let alive = true;
    getPlatform()
      .disk.recycleSize()
      .then((b) => alive && setRecycle(b))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const open = (tool: CareTool) => {
    optimize.openTool(tool).catch(() => toast(w.openFailed));
  };

  // Other systems have none of these tools: nothing to show.
  if (!optimize.windows) return null;
  return (
    <section className={styles.windows} aria-label={w.title}>
      <h2>{w.title}</h2>
      <p className={styles.muted}>{w.lead}</p>
      <Card as="div">
        <ul className={styles.tools}>
          <li className={styles.tool}>
            <div className={styles.toolText}>
              <span className={styles.toolName}>{w.recycle}</span>
              <span className={styles.muted}>{w.recycleHint}</span>
            </div>
            <span className={styles.size}>{recycle === null ? '' : formatBytes(recycle)}</span>
            <Button onClick={() => open('recycleBin')}>{w.recycleOpen}</Button>
          </li>
          <li className={styles.tool}>
            <div className={styles.toolText}>
              <span className={styles.toolName}>{w.updates}</span>
              <span className={styles.muted}>{w.updatesHint}</span>
            </div>
            <span />
            <Button onClick={() => open('storageSettings')}>{w.updatesOpen}</Button>
          </li>
        </ul>
      </Card>
    </section>
  );
}
