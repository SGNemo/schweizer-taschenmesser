import { describe, expect, it } from 'vitest';
import {
  autoYRange,
  BOX,
  DEFAULT_VIEW,
  niceTicks,
  panView,
  sample,
  toPath,
  validRange,
  validView,
  zoomView,
} from './plot';

describe('sample', () => {
  it('takes evenly spaced points including both ends and marks missing values NaN', () => {
    const pts = sample((x) => (x < 0 ? Number.NaN : x * 2), -1, 1, 5);
    expect(pts.map((p) => p.x)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(pts.map((p) => p.y)).toEqual([Number.NaN, Number.NaN, 0, 1, 2]);
    expect(sample(() => Number.POSITIVE_INFINITY, 0, 1, 3).every((p) => Number.isNaN(p.y))).toBe(
      true,
    );
  });
});

describe('autoYRange', () => {
  it('fits the values with some padding', () => {
    const [lo, hi] = autoYRange([sample((x) => x, 0, 10, 101)])!;
    expect(lo).toBeLessThan(0.2);
    expect(hi).toBeGreaterThan(9.8);
    expect(lo).toBeGreaterThan(-1.5);
    expect(hi).toBeLessThan(11.5);
  });
  it('is not squashed by a pole', () => {
    const [lo, hi] = autoYRange([
      sample((x) => Math.tan(x), -1.5, 1.5, 480).concat(sample((x) => 1 / x, -1, 1, 481)),
    ])!;
    expect(hi - lo).toBeLessThan(2000);
    const flat = autoYRange([sample((x) => Math.sin(x), -10, 10)])!;
    expect(flat[0]).toBeGreaterThan(-1.5);
    expect(flat[1]).toBeLessThan(1.5);
  });
  it('gives a flat line some height and nothing for no values', () => {
    const [lo, hi] = autoYRange([sample(() => 3, 0, 1)])!;
    expect(lo).toBeLessThan(3);
    expect(hi).toBeGreaterThan(3);
    expect(autoYRange([sample(() => Number.NaN, 0, 1)])).toBeUndefined();
    expect(autoYRange([])).toBeUndefined();
  });
});

describe('toPath', () => {
  const view = { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
  it('maps points into the box (y up)', () => {
    const d = toPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      view,
    );
    expect(d).toBe(`M0.0 ${BOX.h.toFixed(1)}L${BOX.w.toFixed(1)} 0.0`);
  });
  it('breaks the line at missing values', () => {
    const d = toPath(
      [
        { x: 0, y: 1 },
        { x: 1, y: Number.NaN },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ],
      view,
    );
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(1);
  });
  it('breaks at a pole instead of drawing a vertical line', () => {
    const pts = sample((x) => 1 / x, -2, 2, 401); // jumps from -large to +large at 0
    const d = toPath(pts, { xMin: -2, xMax: 2, yMin: -5, yMax: 5 });
    expect(d.match(/M/g)!.length).toBeGreaterThanOrEqual(2);
  });
  it('leaves out values far outside the range', () => {
    const d = toPath(
      [
        { x: 0, y: 5 },
        { x: 1, y: 1e9 },
        { x: 2, y: 5 },
      ],
      view,
    );
    expect(d.match(/M/g)).toHaveLength(2);
  });
  it('is empty without any value', () => {
    expect(toPath([], view)).toBe('');
    expect(toPath([{ x: 0, y: Number.NaN }], view)).toBe('');
  });
});

describe('niceTicks', () => {
  it.each([
    [-10, 10, [-10, -5, 0, 5, 10]],
    [0, 1, [0, 0.2, 0.4, 0.6, 0.8, 1]],
    [0, 100, [0, 20, 40, 60, 80, 100]],
    [-3.2, 3.2, [-3, -2, -1, 0, 1, 2, 3]],
  ])('%s … %s', (min, max, expected) => {
    expect(niceTicks(min, max)).toEqual(expected);
  });
  it('is safe for nonsense', () => {
    expect(niceTicks(1, 1)).toEqual([]);
    expect(niceTicks(2, 1)).toEqual([]);
    expect(niceTicks(0, Number.NaN)).toEqual([]);
    expect(niceTicks(0, 1e-8).length).toBeLessThan(60);
  });
});

describe('zoom and pan', () => {
  it('zooms in around the centre and out again', () => {
    const z = zoomView(DEFAULT_VIEW, 0.5);
    expect(z).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
    expect(zoomView(z, 2)).toEqual(DEFAULT_VIEW);
  });
  it('zooms around a point', () => {
    const z = zoomView({ xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, 0.5, 0, 0);
    expect(z).toEqual({ xMin: 0, xMax: 5, yMin: 0, yMax: 5 });
  });
  it('never makes the view invalid', () => {
    let v = DEFAULT_VIEW;
    for (let i = 0; i < 100; i++) v = zoomView(v, 0.1);
    expect(validView(v)).toBe(true);
    let w = DEFAULT_VIEW;
    for (let i = 0; i < 100; i++) w = zoomView(w, 10);
    expect(validView(w)).toBe(true);
  });
  it('pans by a fraction', () => {
    expect(panView(DEFAULT_VIEW, 0.25, -0.5)).toEqual({ xMin: -5, xMax: 15, yMin: -20, yMax: 0 });
  });
  it('validates ranges', () => {
    expect(validRange(0, 1)).toBe(true);
    expect(validRange(1, 1)).toBe(false);
    expect(validRange(2, 1)).toBe(false);
    expect(validRange(Number.NaN, 1)).toBe(false);
    expect(validRange(0, 1e13)).toBe(false);
  });
});
