import { useRef, useState } from 'react';
import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { formatBytes, formatCount } from '../format';
import { share, visibleRange, type SortDir, type SortKey } from '../logic/tree';
import styles from './NodeList.module.css';

const ROW = 48;
const VIEWPORT = 448;

export const formatDate = (sec: number): string =>
  sec > 0 ? new Date(sec * 1000).toLocaleDateString('de-DE') : '–';

interface Props {
  nodes: readonly DiskNode[];
  /** Denominator of the share bar (the folder the list belongs to). */
  total: number;
  selectedId: number | null;
  onSelect: (node: DiskNode) => void;
  onOpen: (node: DiskNode) => void;
  /** Parent folder line under the name (query results). */
  where?: (node: DiskNode) => string | undefined;
  sort?: { key: SortKey; dir: SortDir; onChange: (key: SortKey) => void };
  label: string;
}

const nameOf = (n: DiskNode) => (n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name);

/** Windowed table: only the visible rows are in the DOM, so folders with thousands of entries stay smooth. */
export function NodeList({
  nodes,
  total,
  selectedId,
  onSelect,
  onOpen,
  where,
  sort,
  label,
}: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const { start, end } = visibleRange(scrollTop, VIEWPORT, ROW, nodes.length);
  const head = (key: SortKey, text: string) => (
    <div
      role="columnheader"
      aria-sort={sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {sort ? (
        <button
          type="button"
          className={styles.sort}
          aria-label={t.disk.list.sortBy(text)}
          onClick={() => sort.onChange(key)}
        >
          {text}
          {sort.key === key ? (
            <span aria-hidden="true">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>
          ) : null}
        </button>
      ) : (
        text
      )}
    </div>
  );
  return (
    <div role="table" aria-label={label} aria-rowcount={nodes.length + 1} className={styles.table}>
      <div role="row" className={`${styles.row} ${styles.head}`}>
        {head('name', t.disk.list.name)}
        {head('bytes', t.disk.list.size)}
        <div role="columnheader">{t.disk.list.share}</div>
        {head('files', t.disk.list.files)}
        {head('modified', t.disk.list.modified)}
      </div>
      {nodes.length === 0 ? <p className={styles.empty}>{t.disk.list.empty}</p> : null}
      <div
        ref={box}
        className={styles.body}
        style={{ maxHeight: VIEWPORT }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: nodes.length * ROW, position: 'relative' }}>
          {nodes.slice(start, end).map((n, k) => {
            const pct = Math.round(share(n.bytes, total) * 100);
            const at = where?.(n);
            return (
              <div
                key={n.id}
                role="row"
                aria-rowindex={start + k + 2}
                aria-selected={n.id === selectedId}
                className={`${styles.row} ${n.id === selectedId ? styles.selected : ''}`}
                style={{
                  position: 'absolute',
                  top: (start + k) * ROW,
                  height: ROW,
                  left: 0,
                  right: 0,
                }}
                onDoubleClick={() => n.kind !== 'small' && onOpen(n)}
              >
                <div role="cell" className={styles.nameCell}>
                  <button type="button" className={styles.name} onClick={() => onSelect(n)}>
                    <span className={styles.kind} data-kind={n.fileKind} aria-hidden="true" />
                    <span className={styles.text}>
                      <span className={styles.title}>{nameOf(n)}</span>
                      {at !== undefined ? (
                        <span className={styles.where}>
                          {t.disk.list.in} {at || '/'}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
                <div role="cell" className={styles.num}>
                  {formatBytes(n.bytes)}
                </div>
                <div role="cell" className={styles.shareCell}>
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span>{pct} %</span>
                </div>
                <div role="cell" className={styles.num}>
                  {formatCount(n.files)}
                </div>
                <div role="cell" className={styles.num}>
                  {formatDate(n.modified)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
