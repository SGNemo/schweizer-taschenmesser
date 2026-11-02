import { describe, expect, it } from 'vitest';
import {
  countByNotebook,
  filterByNotebook,
  nextNotebookOrder,
  orderPatches,
  SCRATCH_ID,
  sortPages,
} from '../logic';
import { noteSchema } from '../schema';

const page = (id: string, over: Record<string, unknown> = {}, updatedAt = 1) => ({
  ...noteSchema.parse({ title: id, body: '', ...over }),
  id,
  updatedAt,
});

describe('notebook filter', () => {
  const list = [
    page(SCRATCH_ID),
    page('a', { notebookId: 'b1' }),
    page('b', { notebookId: null }),
    page('c', { notebookId: 'b2' }),
  ];
  it('filters by notebook, "none" and "all", and always keeps the scratch pad', () => {
    expect(filterByNotebook(list, 'all')).toHaveLength(4);
    expect(filterByNotebook(list, 'b1').map((n) => n.id)).toEqual([SCRATCH_ID, 'a']);
    expect(filterByNotebook(list, 'none').map((n) => n.id)).toEqual([SCRATCH_ID, 'b']);
  });
  it('counts pages per notebook without the scratch pad', () => {
    const c = countByNotebook(list);
    expect(c.get('b1')).toBe(1);
    expect(c.get(null)).toBe(1);
    expect(c.has(SCRATCH_ID)).toBe(false);
  });
});

describe('sorting', () => {
  const list = [
    page('beta', { order: 20 }, 5),
    page('alpha', { order: 30 }, 1),
    page('gamma', { order: 10, pinned: true }, 3),
    page(SCRATCH_ID, {}, 0),
  ];
  it('keeps the scratch pad first, then pinned, in every mode', () => {
    for (const mode of ['recent', 'title', 'manual'] as const) {
      expect(
        sortPages(list, mode)
          .map((n) => n.id)
          .slice(0, 2),
      ).toEqual([SCRATCH_ID, 'gamma']);
    }
  });
  it('sorts by recency, title and manual order', () => {
    const rest = (m: 'recent' | 'title' | 'manual') =>
      sortPages(list, m)
        .map((n) => n.id)
        .slice(2);
    expect(rest('recent')).toEqual(['beta', 'alpha']);
    expect(rest('title')).toEqual(['alpha', 'beta']);
    expect(rest('manual')).toEqual(['beta', 'alpha']);
  });
  it('uses the given comparison for titles', () => {
    const reverse = (a: string, b: string) => b.localeCompare(a);
    expect(
      sortPages(list, 'title', reverse)
        .map((n) => n.id)
        .slice(2),
    ).toEqual(['beta', 'alpha']);
  });
});

describe('manual order', () => {
  it('only returns pages whose position changed', () => {
    const notes = [
      { id: 'a', order: 10 },
      { id: 'b', order: 20 },
      { id: 'c', order: 30 },
    ];
    expect(orderPatches(['a', 'b', 'c'], notes)).toEqual([]);
    expect(orderPatches(['b', 'a', 'c'], notes)).toEqual([
      { id: 'b', order: 10 },
      { id: 'a', order: 20 },
    ]);
  });
  it('numbers pages that were never ordered (all 0)', () => {
    expect(
      orderPatches(
        ['x', 'y'],
        [
          { id: 'x', order: 0 },
          { id: 'y', order: 0 },
        ],
      ),
    ).toEqual([
      { id: 'x', order: 10 },
      { id: 'y', order: 20 },
    ]);
  });
  it('appends a new notebook after the last one', () => {
    expect(nextNotebookOrder([])).toBe(10);
    expect(nextNotebookOrder([{ order: 10 }, { order: 30 }])).toBe(40);
  });
});
