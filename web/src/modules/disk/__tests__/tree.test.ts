import { describe, expect, it } from 'vitest';
import type { DiskNode } from '@/core/platform/disk';
import {
  groupByParent,
  joinPath,
  kindShares,
  minBytesFor,
  monthsAgoSeconds,
  share,
  sortNodes,
  toLayoutNodes,
  visibleRange,
} from '../logic/tree';

const node = (id: number, parentId: number | null, o: Partial<DiskNode> = {}): DiskNode => ({
  id,
  parentId,
  name: `n${id}`,
  kind: 'dir',
  bytes: 0,
  logicalBytes: 0,
  files: 0,
  modified: 0,
  fileKind: 'other',
  kindBytes: [0, 0, 0, 0, 0, 0, 0],
  childCount: 0,
  ...o,
});

describe('joinPath', () => {
  it('uses the separator of the root and never doubles it', () => {
    expect(joinPath('C:\\', 'Nutzer', 'Beispiel')).toBe('C:\\Nutzer\\Beispiel');
    expect(joinPath('C:\\Daten', 'a')).toBe('C:\\Daten\\a');
    expect(joinPath('/mnt/data/', 'a', 'b')).toBe('/mnt/data/a/b');
    expect(joinPath('D:\\')).toBe('D:\\');
    expect(joinPath('D:\\', '', 'x')).toBe('D:\\x');
  });
});

describe('groupByParent and layout nodes', () => {
  it('groups a flat list by parent and marks folders', () => {
    const list = [node(1, 0), node(2, 0, { kind: 'file', bytes: 5 }), node(3, 1)];
    const groups = groupByParent(list);
    expect(groups.get(0)?.map((n) => n.id)).toEqual([1, 2]);
    expect(groups.get(1)?.map((n) => n.id)).toEqual([3]);
    expect(toLayoutNodes(list).map((n) => n.isDir)).toEqual([true, false, true]);
  });
});

describe('minBytesFor', () => {
  it('drops entries that would be smaller than about 9 pixels', () => {
    expect(minBytesFor(1_000_000, 1000, 1000)).toBe(9);
    expect(minBytesFor(0, 1000, 1000)).toBe(0);
    expect(minBytesFor(1_000_000, 0, 500)).toBe(0);
  });
});

describe('dates and shares', () => {
  it('computes "older than N months" from the injected clock value', () => {
    const nowMs = Date.UTC(2026, 0, 1);
    expect(monthsAgoSeconds(nowMs, 12)).toBe(nowMs / 1000 - 360 * 86_400);
  });
  it('guards a zero whole', () => {
    expect(share(1, 0)).toBe(0);
    expect(share(1, 4)).toBe(0.25);
  });
});

describe('sortNodes', () => {
  const list = [
    node(1, 0, { name: 'Zebra', bytes: 5, files: 9, modified: 3 }),
    node(2, 0, { name: 'apfel', bytes: 50, files: 1, modified: 1 }),
    node(3, 0, { name: 'Ärmel', bytes: 5, files: 4, modified: 2 }),
  ];
  it('sorts by every column in both directions, ties by id', () => {
    expect(sortNodes(list, 'bytes', 'desc').map((n) => n.id)).toEqual([2, 1, 3]);
    expect(sortNodes(list, 'bytes', 'asc').map((n) => n.id)).toEqual([1, 3, 2]);
    expect(sortNodes(list, 'files', 'desc').map((n) => n.id)).toEqual([1, 3, 2]);
    expect(sortNodes(list, 'modified', 'asc').map((n) => n.id)).toEqual([2, 3, 1]);
    expect(sortNodes(list, 'name', 'asc').map((n) => n.name)).toEqual(['apfel', 'Ärmel', 'Zebra']);
  });
  it('does not mutate its input', () => {
    const copy = [...list];
    sortNodes(list, 'bytes', 'desc');
    expect(list).toEqual(copy);
  });
});

describe('visibleRange', () => {
  it('renders the viewport plus overscan and clamps at both ends', () => {
    expect(visibleRange(0, 200, 40, 1000, 2)).toEqual({ start: 0, end: 7 });
    expect(visibleRange(4000, 200, 40, 1000, 2)).toEqual({ start: 98, end: 107 });
    expect(visibleRange(999_999, 200, 40, 10, 2)).toEqual({ start: 3, end: 10 });
    expect(visibleRange(0, 200, 40, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('kindShares', () => {
  it('lists the types by size and leaves out empty ones', () => {
    const s = kindShares({ kindBytes: [30, 0, 10, 0, 0, 60, 0] });
    expect(s.map((k) => k.kind)).toEqual(['document', 'video', 'audio']);
    expect(s[0]!.fraction).toBeCloseTo(0.6);
    expect(kindShares({ kindBytes: [0, 0, 0, 0, 0, 0, 0] })).toEqual([]);
  });
});
