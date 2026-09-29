import { describe, expect, it } from 'vitest';
import { mergeOrder, moveKey, orderWidgets, toggleHidden } from './layout';

const w = (...keys: string[]) => keys.map((key) => ({ key }));
const layout = (order: string[], hidden: string[] = []) => ({ order, hidden });

describe('dashboard layout', () => {
  it('keeps manifest order without a saved layout', () => {
    expect(orderWidgets(w('a', 'b', 'c'), layout([])).map((x) => x.key)).toEqual(['a', 'b', 'c']);
  });

  it('applies the saved order; new widgets go last in manifest order', () => {
    const list = orderWidgets(w('a', 'b', 'c', 'd'), layout(['c', 'a']));
    expect(list.map((x) => x.key)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores saved keys that are no longer available', () => {
    expect(orderWidgets(w('a', 'b'), layout(['gone', 'b', 'a'])).map((x) => x.key)).toEqual([
      'b',
      'a',
    ]);
  });

  it('moves a key onto the position of another', () => {
    expect(moveKey(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveKey(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(moveKey(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'a', 'zzz')).toEqual(['a', 'b']);
  });

  it('keeps positions of unavailable widgets when saving', () => {
    expect(mergeOrder(['b', 'a'], layout(['x', 'a', 'b', 'y']))).toEqual(['b', 'a', 'x', 'y']);
  });

  it('toggles hidden keys', () => {
    expect(toggleHidden(layout([], []), 'a')).toEqual(['a']);
    expect(toggleHidden(layout([], ['a', 'b']), 'a')).toEqual(['b']);
  });
});
