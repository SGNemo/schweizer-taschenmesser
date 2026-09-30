import { FILE_KINDS, type DiskNode, type FileKind } from '@/core/platform/disk';
import type { LayoutNode } from './treemap';

/** Display path: `root` (e.g. `C:\`) plus folder names, with the separator the root uses. */
export function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes('\\') ? '\\' : '/';
  const clean = parts.filter(Boolean);
  if (!clean.length) return root;
  return `${root.replace(/[\\/]+$/, '')}${sep}${clean.join(sep)}`;
}

export function groupByParent(nodes: readonly DiskNode[]): Map<number, DiskNode[]> {
  const map = new Map<number, DiskNode[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    const list = map.get(n.parentId);
    if (list) list.push(n);
    else map.set(n.parentId, [n]);
  }
  return map;
}

export const toLayoutNodes = (nodes: readonly DiskNode[]): LayoutNode[] =>
  nodes.map((n) => ({ id: n.id, value: n.bytes, isDir: n.kind === 'dir' }));

/**
 * Smallest entry worth fetching for a canvas: anything that would get less than `minArea` pixels
 * is left out on the native side, which keeps the payload small even for millions of files.
 */
export function minBytesFor(total: number, width: number, height: number, minArea = 9): number {
  const area = width * height;
  if (!(total > 0) || !(area > 0)) return 0;
  return Math.floor((total * minArea) / area);
}

/** Unix seconds for "older than N months" (30-day months are precise enough for a clean-up hint). */
export const monthsAgoSeconds = (nowMs: number, months: number): number =>
  Math.floor(nowMs / 1000) - months * 30 * 86_400;

export const share = (part: number, whole: number): number => (whole > 0 ? part / whole : 0);

export type SortKey = 'name' | 'bytes' | 'files' | 'modified';
export type SortDir = 'asc' | 'desc';

const label = (n: DiskNode) => n.name.toLocaleLowerCase('de');

export function sortNodes(nodes: readonly DiskNode[], key: SortKey, dir: SortDir): DiskNode[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    const c = key === 'name' ? label(a).localeCompare(label(b), 'de') : a[key] - b[key];
    return c * sign || a.id - b.id;
  });
}

/** Window of rows to render for a scrolled list (`overscan` rows above and below). */
export function visibleRange(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan = 6,
): { start: number; end: number } {
  // A list that shrank while scrolled far down (filter change) reports a stale scrollTop.
  const top = Math.min(scrollTop, Math.max(0, count * rowHeight - viewport));
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((top + viewport) / rowHeight) + overscan);
  return { start, end: Math.max(start, end) };
}

/** File type breakdown of a node, biggest first, zero entries left out. */
export function kindShares(node: Pick<DiskNode, 'kindBytes'>): {
  kind: FileKind;
  bytes: number;
  fraction: number;
}[] {
  const total = node.kindBytes.reduce((s, b) => s + b, 0);
  return FILE_KINDS.map((kind, i) => ({
    kind,
    bytes: node.kindBytes[i] ?? 0,
    fraction: share(node.kindBytes[i] ?? 0, total),
  }))
    .filter((k) => k.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
}
