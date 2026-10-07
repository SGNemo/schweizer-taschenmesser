import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  effectiveSize,
  mergeOrder,
  migrateLegacyLayout,
  moveKey,
  orderWidgets,
  resolveLayout,
  toggleHidden,
  withSize,
} from './layout';

const w = (...keys: string[]) => keys.map((key) => ({ key }));
const layout = (order: string[], hidden: string[] = []) => ({ order, hidden, sizes: {} });

describe('home layout', () => {
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

describe('home layout: sizes', () => {
  const w = { sizes: ['s', 'm'] as const, defaultSize: 's' as const };
  it('falls back to the default when nothing (valid) is chosen', () => {
    expect(effectiveSize(w, 'a:x', DEFAULT_LAYOUT)).toBe('s');
    expect(effectiveSize(w, 'a:x', { ...DEFAULT_LAYOUT, sizes: { 'a:x': 'l' } })).toBe('s');
    expect(effectiveSize(w, 'a:x', { ...DEFAULT_LAYOUT, sizes: { 'a:x': 'm' } })).toBe('m');
  });

  it('stores the default size as "no choice"', () => {
    const base = { ...DEFAULT_LAYOUT, sizes: { 'a:x': 'm' as const } };
    expect(withSize(base, 'a:x', 's', 's')).toEqual({});
    expect(withSize(DEFAULT_LAYOUT, 'a:x', 'm', 's')).toEqual({ 'a:x': 'm' });
  });
});

describe('home layout: migration of the old dashboard settings', () => {
  it('keeps order and hidden keys, adds empty sizes', () => {
    expect(migrateLegacyLayout({ order: ['b:x', 'a:y'], hidden: ['a:y'] })).toEqual({
      order: ['b:x', 'a:y'],
      hidden: ['a:y'],
      sizes: {},
    });
  });

  it('tolerates missing or broken legacy values', () => {
    expect(migrateLegacyLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(migrateLegacyLayout({ order: 'x', hidden: ['k'] })).toEqual({
      order: [],
      hidden: ['k'],
      sizes: {},
    });
  });

  it('uses the legacy record only until a home record exists', () => {
    const legacy = { order: ['a:x'], hidden: ['b:y'] };
    expect(resolveLayout(undefined, legacy).hidden).toEqual(['b:y']);
    expect(resolveLayout({ order: ['c:z'], hidden: [], sizes: {} }, legacy).order).toEqual(['c:z']);
    // a partial home record (e.g. written by an older build) is completed with defaults
    expect(resolveLayout({ hidden: ['q:r'] }, legacy)).toEqual({
      order: [],
      hidden: ['q:r'],
      sizes: {},
    });
  });

  it('maps the widget of the former system module to "Dieser PC"', () => {
    expect(
      resolveLayout(
        {
          order: ['system:status', 'a:x'],
          hidden: ['system:status'],
          sizes: { 'system:status': 'm' },
        },
        undefined,
      ),
    ).toEqual({
      order: ['disk:system', 'a:x'],
      hidden: ['disk:system'],
      sizes: { 'disk:system': 'm' },
    });
  });

  it('falls back to the defaults on an invalid home record', () => {
    expect(resolveLayout({ sizes: { 'a:x': 'xl' } }, undefined)).toEqual(DEFAULT_LAYOUT);
  });
});
