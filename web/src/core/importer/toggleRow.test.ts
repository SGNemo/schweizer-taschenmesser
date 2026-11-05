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
  it('a row whose list is invalid cannot be ticked', () => {
    const list = { ...row(0, 'list', undefined, false), invalid: 'broken' };
    const all = [list, row(1, 'a', 'list', false), row(2, 'other')];
    expect(toggleRow(all, 1, true).map((r) => r.selected)).toEqual([false, false, true]);
  });
  it('unticking one dependent leaves the list and its siblings', () => {
    expect(toggleRow(rows(), 1, false).map((r) => r.selected)).toEqual([true, false, true, true]);
  });
  it('follows a chain: list → task → subtask (X12)', () => {
    const chain = () => [
      row(0, 'list'),
      row(1, 'task', 'list'),
      row(2, 'sub', 'task'),
      row(3, 'x'),
    ];
    const off = toggleRow(chain(), 0, false);
    expect(off.map((r) => r.selected)).toEqual([false, false, false, true]);
    expect(toggleRow(off, 2, true).map((r) => r.selected)).toEqual([true, true, true, true]);
    const broken = [{ ...row(0, 'list', undefined, false), invalid: 'x' }, ...chain().slice(1, 3)];
    expect(toggleRow(broken, 2, true).map((r) => r.selected)).toEqual([false, true, true]);
  });
});
