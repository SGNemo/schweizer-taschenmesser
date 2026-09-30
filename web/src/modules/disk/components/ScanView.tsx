import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import {
  FILE_KINDS,
  type DiskNode,
  type DiskQuery,
  type FileKind,
  type ScanSummary,
} from '@/core/platform/disk';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Card, Chip, Chips, SelectField, Segmented, SplitView, Toolbar, useSplitView } from '@/ui';
import { formatBytes, formatCount, percent } from '../format';
import {
  joinPath,
  minBytesFor,
  monthsAgoSeconds,
  sortNodes,
  type SortDir,
  type SortKey,
} from '../logic/tree';
import { Breadcrumb } from './Breadcrumb';
import { Details } from './Details';
import { Legend } from './Legend';
import { NodeList, formatDate } from './NodeList';
import { TreemapView, type ColorMode } from './TreemapView';
import palette from './Palette.module.css';
import styles from './ScanView.module.css';

type FilterKind = 'none' | 'topDirs' | 'topFiles' | 'old' | 'type';
interface Filter {
  kind: FilterKind;
  months: number;
  fileKind: FileKind;
  scope: 'dirs' | 'files';
}
const MONTHS = [3, 6, 12, 24, 36];

function toQuery(f: Filter, under: number | undefined): DiskQuery | null {
  const base = { under, limit: 200 };
  switch (f.kind) {
    case 'topDirs':
      return { ...base, scope: 'dirs' };
    case 'topFiles':
      return { ...base, scope: 'files' };
    case 'old':
      return { ...base, scope: f.scope, olderThan: monthsAgoSeconds(now(), f.months) };
    case 'type':
      return { ...base, scope: f.scope, fileKind: f.fileKind };
    default:
      return null;
  }
}

/** Explore a finished scan: treemap or list, breadcrumb, quick filters and a details panel. */
export function ScanView({ summary }: { summary: ScanSummary }) {
  const disk = getPlatform().disk;
  const { scanId, root, rootNode } = summary;
  const [trail, setTrail] = useState<DiskNode[]>([rootNode]);
  const current = trail[trail.length - 1]!;
  const [selected, setSelected] = useState<DiskNode | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [colorBy, setColorBy] = useState<ColorMode>('type');
  const [filter, setFilter] = useState<Filter>({
    kind: 'none',
    months: 12,
    fileKind: 'video',
    scope: 'files',
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'bytes', dir: 'desc' });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mapNodes, setMapNodes] = useState<DiskNode[]>([]);
  const [listNodes, setListNodes] = useState<DiskNode[]>([]);
  const [results, setResults] = useState<DiskNode[]>([]);
  const split = useSplitView();
  const cache = useRef(new Map<number, DiskNode>());

  const filtering = filter.kind !== 'none';
  const shown: 'map' | 'list' = filtering ? 'list' : view;

  // The canvas size in 64 px steps: a resize drag must not refetch on every pixel.
  const onSize = useCallback((w: number, h: number) => {
    const next = { w: Math.ceil(w / 64) * 64, h: Math.ceil(h / 64) * 64 };
    setSize((s) => (s.w === next.w && s.h === next.h ? s : next));
  }, []);
  const minBytes = minBytesFor(current.bytes, size.w, size.h);

  useEffect(() => {
    if (shown !== 'map' || size.w === 0) return;
    let alive = true;
    disk
      .children(scanId, current.id, 2, minBytes)
      .then((n) => alive && setMapNodes(n))
      .catch(() => alive && setMapNodes([]));
    return () => {
      alive = false;
    };
  }, [disk, scanId, current.id, shown, size.w, minBytes]);

  useEffect(() => {
    if (shown !== 'list' || filtering) return;
    let alive = true;
    disk
      .children(scanId, current.id, 1, 0)
      .then((n) => alive && setListNodes(n))
      .catch(() => alive && setListNodes([]));
    return () => {
      alive = false;
    };
  }, [disk, scanId, current.id, shown, filtering]);

  useEffect(() => {
    const q = toQuery(filter, current.id === rootNode.id ? undefined : current.id);
    if (!q) return;
    let alive = true;
    disk
      .query(scanId, q)
      .then((n) => alive && setResults(n))
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [disk, scanId, filter, current.id, rootNode.id]);

  const lookup = useMemo(
    () => new Map([...trail, ...mapNodes, ...listNodes, ...results].map((n) => [n.id, n])),
    [trail, mapNodes, listNodes, results],
  );

  const pathOf = useCallback(
    (n: DiskNode): string => {
      if (n.id === rootNode.id) return root;
      if (n.relPath !== undefined) {
        return joinPath(root, ...n.relPath.split(/[\\/]/), n.kind === 'small' ? '' : n.name);
      }
      const names: string[] = [];
      for (
        let cur: DiskNode | undefined = n;
        cur && cur.id !== rootNode.id;
        cur = lookup.get(cur.parentId ?? -1)
      ) {
        names.unshift(cur.kind === 'small' ? '' : cur.name);
      }
      return joinPath(root, ...names);
    },
    [lookup, root, rootNode.id],
  );

  const entries = useMemo(
    () => (shown === 'map' ? mapNodes.filter((n) => n.parentId === current.id) : listNodes),
    [shown, mapNodes, listNodes, current.id],
  );
  const sortedList = useMemo(() => sortNodes(listNodes, sort.key, sort.dir), [listNodes, sort]);

  const chainTo = useCallback(
    async (n: DiskNode): Promise<DiskNode[]> => {
      const up: DiskNode[] = [];
      let pid = n.parentId;
      while (pid !== null) {
        let p = cache.current.get(pid);
        if (!p) {
          p = (await disk.node(scanId, pid)) ?? undefined;
          if (!p) break;
          cache.current.set(pid, p);
        }
        up.unshift(p);
        pid = p.parentId;
      }
      return up;
    },
    [disk, scanId],
  );

  const open = useCallback(
    async (n: DiskNode) => {
      const up = n.parentId === current.id ? trail : await chainTo(n);
      if (n.kind === 'dir') {
        setTrail([...up, n]);
        setSelected(null);
      } else {
        setTrail(up.length ? up : [rootNode]);
        setSelected(n);
      }
      setFilter((f) => ({ ...f, kind: 'none' }));
    },
    [chainTo, current.id, rootNode, trail],
  );

  const up = useCallback(() => {
    setTrail((tr) => (tr.length > 1 ? tr.slice(0, -1) : tr));
    setSelected(null);
  }, []);

  const jump = (index: number) => {
    setTrail(trail.slice(0, index + 1));
    setSelected(null);
  };

  const zoom = useCallback((n: DiskNode) => {
    setTrail((tr) => [...tr, n]);
    setSelected(null);
  }, []);

  const tooltip = useCallback(
    (n: DiskNode) => (
      <>
        <strong>{n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name}</strong>
        <dl>
          {n.kind !== 'small' ? (
            <>
              <dt>{t.disk.details.path}</dt>
              <dd>{pathOf(n)}</dd>
            </>
          ) : null}
          <dt>{t.disk.details.used}</dt>
          <dd>{formatBytes(n.bytes)}</dd>
          <dt>{t.disk.list.share}</dt>
          <dd>{percent(n.bytes, current.bytes)} %</dd>
          <dt>{t.disk.details.files}</dt>
          <dd>{formatCount(n.files)}</dd>
          <dt>{t.disk.list.modified}</dt>
          <dd>{formatDate(n.modified)}</dd>
        </dl>
      </>
    ),
    [pathOf, current.bytes],
  );

  const setKind = (kind: FilterKind) => setFilter((f) => ({ ...f, kind }));
  const detailNode = selected ?? current;
  const detailsCard = (
    <Card>
      <Details
        node={detailNode}
        current={current}
        path={pathOf(detailNode)}
        biggest={entries}
        onOpen={(n) => void open(n)}
        onSelect={setSelected}
      />
    </Card>
  );

  return (
    <div className={`${palette.palette} ${styles.root}`}>
      <Breadcrumb trail={trail} onJump={jump} />
      <Toolbar>
        <Segmented
          label={t.disk.views.label}
          value={view}
          options={[
            { value: 'map', label: t.disk.views.map },
            { value: 'list', label: t.disk.views.list },
          ]}
          onChange={setView}
        />
        {shown === 'map' ? (
          <Segmented
            label={t.disk.map.colorBy}
            value={colorBy}
            options={[
              { value: 'type', label: t.disk.map.byType },
              { value: 'depth', label: t.disk.map.byDepth },
            ]}
            onChange={setColorBy}
          />
        ) : null}
      </Toolbar>
      <Chips>
        <Chip
          label={t.disk.filter.none}
          selected={filter.kind === 'none'}
          onClick={() => setKind('none')}
        />
        <Chip
          label={t.disk.filter.topDirs}
          selected={filter.kind === 'topDirs'}
          onClick={() => setKind('topDirs')}
        />
        <Chip
          label={t.disk.filter.topFiles}
          selected={filter.kind === 'topFiles'}
          onClick={() => setKind('topFiles')}
        />
        <Chip
          label={t.disk.filter.old}
          selected={filter.kind === 'old'}
          onClick={() => setKind('old')}
        />
        <Chip
          label={t.disk.filter.type}
          selected={filter.kind === 'type'}
          onClick={() => setKind('type')}
        />
      </Chips>
      {filter.kind === 'old' || filter.kind === 'type' ? (
        <Toolbar>
          {filter.kind === 'old' ? (
            <SelectField
              label={t.disk.filter.old}
              value={filter.months}
              onChange={(e) => setFilter((f) => ({ ...f, months: Number(e.target.value) }))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {t.disk.filter.months(m)}
                </option>
              ))}
            </SelectField>
          ) : (
            <SelectField
              label={t.disk.filter.type}
              value={filter.fileKind}
              onChange={(e) => setFilter((f) => ({ ...f, fileKind: e.target.value as FileKind }))}
            >
              {FILE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.disk.map.kind[k]}
                </option>
              ))}
            </SelectField>
          )}
          <Segmented
            label={t.disk.filter.scope}
            value={filter.scope}
            options={[
              { value: 'files', label: t.disk.filter.files },
              { value: 'dirs', label: t.disk.filter.dirs },
            ]}
            onChange={(scope) => setFilter((f) => ({ ...f, scope }))}
          />
        </Toolbar>
      ) : null}

      <SplitView enabled={split} aside={detailsCard} asideLabel={t.disk.details.title}>
        <div className={styles.main}>
          {shown === 'map' ? (
            <>
              <TreemapView
                root={current}
                nodes={mapNodes}
                colorBy={colorBy}
                selectedId={selected?.id ?? null}
                onSize={onSize}
                onZoom={zoom}
                onSelect={setSelected}
                onUp={up}
                tooltip={tooltip}
              />
              <Legend colorBy={colorBy} />
              <p id="disk-map-help" className={styles.help}>
                {t.disk.map.help}
              </p>
            </>
          ) : filtering ? (
            <>
              <p className={styles.help} aria-live="polite">
                {t.disk.filter.results(results.length)} ·{' '}
                {t.disk.filter.inFolder(current.id === rootNode.id ? root : current.name)}
              </p>
              <NodeList
                nodes={results}
                total={current.bytes}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                onOpen={(n) => void open(n)}
                where={(n) => n.relPath}
                label={t.disk.filter.label}
              />
            </>
          ) : (
            <NodeList
              nodes={sortedList}
              total={current.bytes}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onOpen={(n) => void open(n)}
              sort={{
                key: sort.key,
                dir: sort.dir,
                onChange: (key) =>
                  setSort((s) => ({
                    key,
                    dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc',
                  })),
              }}
              label={t.disk.list.label}
            />
          )}
          {split ? null : detailsCard}
        </div>
      </SplitView>
    </div>
  );
}
