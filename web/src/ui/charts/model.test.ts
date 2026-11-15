import { describe, expect, it } from 'vitest';
import {
  arcs,
  areaPath,
  foldShares,
  formatShare,
  fraction,
  labelIndexes,
  lastValue,
  linePath,
  niceScale,
} from './model';

const d = (label: string, value: number) => ({ label, value });

describe('foldShares', () => {
  it('sorts largest first and keeps ties in input order', () => {
    const s = foldShares([d('a', 1), d('b', 3), d('c', 1)], 'Rest');
    expect(s.map((x) => x.label)).toEqual(['b', 'a', 'c']);
    expect(s.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(s.reduce((sum, x) => sum + x.share, 0)).toBeCloseTo(1);
  });

  it('folds everything after six into one "other" slice', () => {
    const data = Array.from({ length: 10 }, (_, i) => d(`k${i}`, 100 - i));
    const s = foldShares(data, 'Sonstiges');
    expect(s).toHaveLength(7);
    expect(s[6]).toMatchObject({ label: 'Sonstiges', other: true, value: 94 + 93 + 92 + 91 });
  });

  it('seven values: six named, the seventh is "Sonstiges" (never a slice without a pattern slot)', () => {
    const data = Array.from({ length: 7 }, (_, i) => d(`k${i}`, 10 - i));
    const s = foldShares(data, 'Sonstiges');
    expect(s).toHaveLength(7);
    expect(s[6]).toMatchObject({ label: 'Sonstiges', other: true, value: 4 });
  });

  it('never more than six named slices, whatever `max` asks for', () => {
    const data = Array.from({ length: 12 }, (_, i) => d(`k${i}`, 20 - i));
    expect(foldShares(data, 'R', 10).filter((x) => !x.other)).toHaveLength(6);
  });

  it('small steps give clean ticks', () => {
    expect(niceScale([0.1, 0.35]).ticks.every((v) => String(v).length <= 4)).toBe(true);
  });

  it('leaves out zero, negative and non-finite values; nothing usable gives no slices', () => {
    expect(foldShares([d('a', 0), d('b', -5), d('c', Number.NaN)], 'R')).toEqual([]);
    expect(foldShares([d('a', 2), d('b', -5)], 'R').map((x) => x.label)).toEqual(['a']);
  });

  it('a single value is the whole', () => {
    expect(foldShares([d('Miete', 850)], 'R')).toEqual([
      { key: '0', label: 'Miete', value: 850, share: 1, index: 0, other: false },
    ]);
  });
});

describe('formatShare', () => {
  it('rounds to whole percent and never shows a real share as 0 %', () => {
    expect(formatShare(0.4237)).toMatch(/^42\s?%$/);
    expect(formatShare(0.001)).toMatch(/^< 1\s?%$/);
    expect(formatShare(0)).toMatch(/^0\s?%$/);
  });
});

describe('niceScale', () => {
  it('rounds the bounds to nice steps', () => {
    const s = niceScale([13, 87]);
    expect(s.min).toBe(0);
    expect(s.max).toBe(100);
    expect(s.ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it('a line may start above zero, `zero` pulls zero in', () => {
    expect(niceScale([980, 1020]).min).toBeGreaterThan(0);
    expect(niceScale([980, 1020], { zero: true }).min).toBe(0);
  });

  it('holds negative values and keeps an exact zero tick', () => {
    const s = niceScale([-120, 340]);
    expect(s.min).toBeLessThanOrEqual(-120);
    expect(s.max).toBeGreaterThanOrEqual(340);
    expect(s.ticks).toContain(0);
    expect(s.ticks.every((v) => !Object.is(v, -0))).toBe(true);
  });

  it('a flat series gets room; all zero with `zero` becomes 0…1', () => {
    const flat = niceScale([500, 500]);
    expect(flat.min).toBeLessThan(500);
    expect(flat.max).toBeGreaterThan(500);
    expect(niceScale([0, 0], { zero: true })).toMatchObject({ min: 0, max: 1 });
    expect(niceScale([])).toMatchObject({ min: expect.any(Number), max: expect.any(Number) });
  });
});

describe('fraction', () => {
  it('maps onto 0…1 and clamps', () => {
    expect(fraction(50, { min: 0, max: 100 })).toBe(0.5);
    expect(fraction(150, { min: 0, max: 100 })).toBe(1);
    expect(fraction(-1, { min: 0, max: 100 })).toBe(0);
  });
});

describe('labelIndexes', () => {
  it('shows all when they fit', () => {
    expect([...labelIndexes(4, 6)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
  it('thins out from the end, the last always shows', () => {
    const shown = labelIndexes(12, 4);
    expect(shown.size).toBeLessThanOrEqual(4);
    expect(shown.has(11)).toBe(true);
    expect([...shown].sort((a, b) => a - b)).toEqual([2, 5, 8, 11]);
  });
});

describe('paths', () => {
  const scale = { min: 0, max: 100 };
  it('linePath spans the box and starts again after a gap', () => {
    expect(linePath([0, 50, 100], scale)).toBe('M0 100L50 50L100 0');
    expect(linePath([10, null, 30, 40], scale)).toBe('M0 90M66.67 70L100 60');
  });
  it('a single point is centred', () => {
    expect(linePath([50], scale)).toBe('M50 50');
  });
  it('areaPath closes each run down to zero and skips lone points', () => {
    expect(areaPath([0, 100], scale)).toBe('M0 100L0 100L100 0L100 100Z');
    expect(areaPath([10, null, 30, 40], scale)).toBe('M66.67 100L66.67 70L100 60L100 100Z');
  });
  it('lastValue finds the newest real value', () => {
    expect(lastValue([1, 2, null])).toEqual({ i: 1, v: 2 });
    expect(lastValue([null])).toBeNull();
  });
});

describe('arcs', () => {
  it('lays the slices end to end with a gap; one slice closes the ring', () => {
    const a = arcs([{ share: 0.75 }, { share: 0.25 }], 1);
    expect(a.map((x) => [x.start, x.length])).toEqual([
      [0, 74],
      [75, 24],
    ]);
    expect(arcs([{ share: 1 }], 1)[0]).toMatchObject({ start: 0, length: 100 });
  });
});
