/** Pure maths of the function plotter: sampling, range, tick marks, zoom and pan, path building. */

export interface PlotView {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const DEFAULT_VIEW: PlotView = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
export const SAMPLES = 480;
/** The graph is drawn in a box of this size (the SVG scales it). */
export const BOX = { w: 480, h: 320 } as const;

export const validRange = (min: number, max: number): boolean =>
  Number.isFinite(min) && Number.isFinite(max) && min < max && max - min < 1e12 && max - min > 1e-9;

export const validView = (v: PlotView): boolean =>
  validRange(v.xMin, v.xMax) && validRange(v.yMin, v.yMax);

export interface Point {
  x: number;
  y: number;
}

/** `n` evenly spaced samples of `fn` over [xMin, xMax]; `y` is NaN where the function has no real value. */
export function sample(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  n = SAMPLES,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const x = xMin + ((xMax - xMin) * i) / (n - 1);
    const y = fn(x);
    out.push({ x, y: Number.isFinite(y) ? y : Number.NaN });
  }
  return out;
}

/**
 * A y range that shows the interesting part: the 2nd to 98th percentile of all finite values (a pole like
 * tan(x) or 1/x does not squash the rest), a little padding, and a minimum height for a flat line.
 * `undefined` when there is no finite value at all.
 */
export function autoYRange(series: readonly (readonly Point[])[]): [number, number] | undefined {
  const ys = series
    .flatMap((s) => s.map((p) => p.y))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  if (ys.length === 0) return undefined;
  const at = (q: number) =>
    ys[Math.min(ys.length - 1, Math.max(0, Math.round(q * (ys.length - 1))))]!;
  let lo = at(0.02);
  let hi = at(0.98);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/**
 * SVG path data for one series. The line is broken where the function has no value, where it leaves the
 * visible range by far, and at a jump across the range (a pole such as 1/x or tan(x)), so no false vertical
 * line is drawn.
 */
export function toPath(points: readonly Point[], view: PlotView): string {
  const { w, h } = BOX;
  const sx = w / (view.xMax - view.xMin);
  const sy = h / (view.yMax - view.yMin);
  const height = view.yMax - view.yMin;
  const X = (x: number) => (x - view.xMin) * sx;
  const Y = (y: number) => h - (y - view.yMin) * sy;
  let d = '';
  let pen = false;
  let prev: Point | undefined;
  for (const p of points) {
    const far =
      !Number.isFinite(p.y) || p.y < view.yMin - 3 * height || p.y > view.yMax + 3 * height;
    if (far) {
      pen = false;
      prev = undefined;
      continue;
    }
    const jump =
      prev !== undefined &&
      Math.abs(p.y - prev.y) > 1.5 * height &&
      Math.sign(p.y) !== Math.sign(prev.y);
    if (!pen || jump) {
      d += `M${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`;
      pen = true;
    } else {
      d += `L${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`;
    }
    prev = p;
  }
  return d;
}

/** "Nice" tick values (1, 2 or 5 × a power of ten) inside [min, max], about `target` of them. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const rough = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
  const first = Math.ceil(min / step - 1e-9);
  const out: number[] = [];
  for (let i = first; i * step <= max + step * 1e-9 && out.length < 50; i++) {
    out.push(Number((i * step).toPrecision(12)));
  }
  return out;
}

/** Zooms around a point (default: the centre); `factor` < 1 zooms in, > 1 out. */
export function zoomView(v: PlotView, factor: number, cx?: number, cy?: number): PlotView {
  const x = cx ?? (v.xMin + v.xMax) / 2;
  const y = cy ?? (v.yMin + v.yMax) / 2;
  const next = {
    xMin: x - (x - v.xMin) * factor,
    xMax: x + (v.xMax - x) * factor,
    yMin: y - (y - v.yMin) * factor,
    yMax: y + (v.yMax - y) * factor,
  };
  return validView(next) ? next : v;
}

/** Moves the view by a fraction of its width and height (positive: right / up). */
export function panView(v: PlotView, dx: number, dy: number): PlotView {
  const w = v.xMax - v.xMin;
  const h = v.yMax - v.yMin;
  return {
    xMin: v.xMin + dx * w,
    xMax: v.xMax + dx * w,
    yMin: v.yMin + dy * h,
    yMax: v.yMax + dy * h,
  };
}

/** Pixel position of a value inside the box. */
export const px = (v: PlotView, x: number): number => ((x - v.xMin) / (v.xMax - v.xMin)) * BOX.w;
export const py = (v: PlotView, y: number): number =>
  BOX.h - ((y - v.yMin) / (v.yMax - v.yMin)) * BOX.h;
