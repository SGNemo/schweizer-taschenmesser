import { describe, expect, it } from 'vitest';
import type { DiskNode } from '@/core/platform/disk';
import type { CleanupPlace } from '@/core/platform/optimize';
import {
  initialSelection,
  pruneSelection,
  refreshPlace,
  restBytes,
  restIds,
  restSelected,
  selectedBytes,
  selectedIds,
  setAll,
  setRest,
  toggleItem,
  totalBytes,
} from '../logic/cleanup';

const node = (id: number, bytes: number, files = 1): DiskNode => ({
  id,
  parentId: 0,
  name: `n${id}`,
  kind: 'file',
  bytes,
  logicalBytes: bytes,
  files,
  modified: 0,
  accessed: 0,
  fileKind: 'other',
  kindBytes: [],
  ageBytes: [],
  childCount: 0,
});

/** Three entries with a preview row (1–3) and two without (4, 5: 30 bytes together). */
const place = (over: Partial<CleanupPlace> = {}): CleanupPlace => ({
  category: 'temp',
  source: '',
  scanId: 7,
  path: 'C:\\Temp',
  items: [node(1, 500), node(2, 300), node(3, 100)],
  ids: [1, 2, 3, 4, 5],
  totalBytes: 930,
  totalFiles: 5,
  preselected: true,
  minAgeDays: 7,
  busy: false,
  ...over,
});

describe('clean-up selection', () => {
  it('ticks everything for caches and nothing for the user’s own downloads', () => {
    expect([...initialSelection(place())]).toEqual([1, 2, 3, 4, 5]);
    expect(initialSelection(place({ preselected: false })).size).toBe(0);
  });

  it('toggles one entry and the rest as a group', () => {
    const p = place();
    let s = toggleItem(initialSelection(p), 2);
    expect(selectedIds(p, s)).toEqual([1, 3, 4, 5]);
    s = toggleItem(s, 2);
    expect(selectedIds(p, s)).toEqual([1, 2, 3, 4, 5]);
    expect(restIds(p)).toEqual([4, 5]);
    s = setRest(p, s, false);
    expect(selectedIds(p, s)).toEqual([1, 2, 3]);
    expect(restSelected(p, s)).toBe(false);
    expect(restSelected(p, setRest(p, s, true))).toBe(true);
    expect(setAll(p, false).size).toBe(0);
    expect(setAll(p, true).size).toBe(5);
  });

  it('sums the ticked preview rows and counts the rest only as a whole', () => {
    const p = place();
    expect(restBytes(p)).toBe(30);
    expect(selectedBytes(p, initialSelection(p))).toBe(930);
    expect(selectedBytes(p, new Set([1, 3]))).toBe(600);
    // Half of the rest ticked cannot happen in the UI; it then counts as not ticked.
    expect(selectedBytes(p, new Set([1, 4]))).toBe(500);
    expect(selectedBytes(p, new Set([4, 5]))).toBe(30);
  });

  it('has no rest when every entry has a preview row', () => {
    const p = place({ ids: [1, 2, 3], totalBytes: 900 });
    expect(restIds(p)).toEqual([]);
    expect(restSelected(p, initialSelection(p))).toBe(false);
    expect(selectedBytes(p, initialSelection(p))).toBe(900);
  });
});

describe('after a delete run', () => {
  it('keeps only what still exists and recounts', () => {
    const p = place();
    const next = refreshPlace(p, [node(2, 300), node(5, 20), node(99, 1_000)]);
    expect(next?.ids).toEqual([2, 5]);
    expect(next?.items.map((n) => n.id)).toEqual([2]);
    expect(next?.totalBytes).toBe(320);
    expect(next?.totalFiles).toBe(2);
    expect([...pruneSelection(next!, new Set([1, 2, 5]))]).toEqual([2, 5]);
  });

  it('drops a suggestion that is empty', () => {
    expect(refreshPlace(place(), [node(99, 1)])).toBeNull();
  });

  it('takes the new size of an entry that was only partly deleted', () => {
    const next = refreshPlace(place({ ids: [1], items: [node(1, 500)] }), [node(1, 120, 3)]);
    expect(next?.totalBytes).toBe(120);
    expect(next?.items[0]?.bytes).toBe(120);
  });
});

describe('summary figures', () => {
  it('adds up the suggestions', () => {
    expect(totalBytes([place(), place({ totalBytes: 70 })])).toBe(1000);
    expect(totalBytes([])).toBe(0);
  });
});
