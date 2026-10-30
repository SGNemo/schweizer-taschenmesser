import { describe, expect, it } from 'vitest';
import { toggleRow } from './ImportPreview';
import type { PreviewRow } from './types';

const row = (index: number, id: string, dependsOn?: string, selected = true): PreviewRow => ({
  index,
  candidate: {
    collection: 'task',
    id,
    data: {},
    label: id,
    dedupeKey: id,
    ...(dependsOn ? { dependsOn } : {}),
  },
  duplicate: false,
  selected,
});

describe('toggleRow', () => {
  const rows = () => [row(0, 'list'), row(1, 'a', 'list'), row(2, 'b', 'list'), row(3, 'other')];
  it('unticking the list unticks the rows that need it', () => {
    expect(toggleRow(rows(), 0, false).map((r) => r.selected)).toEqual([false, false, false, true]);
  });
  it('ticking a dependent row ticks its list again, other rows stay', () => {
    const off = toggleRow(rows(), 0, false);
    expect(toggleRow(off, 1, true).map((r) => r.selected)).toEqual([true, true, false, true]);
  });
  it('unticking one dependent leaves the list and its siblings', () => {
    expect(toggleRow(rows(), 1, false).map((r) => r.selected)).toEqual([true, false, true, true]);
  });
});
