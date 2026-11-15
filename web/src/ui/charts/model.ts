/**
 * Pure geometry and grouping for the shared charts (`@/ui/charts`). No React, no DOM: every rule a chart follows
 * (what folds into "Sonstiges", where the ticks fall, which labels show) lives here and is unit-tested.
 */
import { formatNumber } from '@/core/i18n/format';

/** One value with its name. `id` keeps React keys stable when two labels are the same. */
export interface ChartDatum {
  id?: string;
  label: string;
  value: number;
}

/** A slice of the donut after grouping: `index` is its colour/pattern slot (0 = strongest), `other` the rest. */
export interface Share {
  key: string;
  label: string;
  value: number;
  /** 0..1 of the total. */
  share: number;
  index: number;
  other: boolean;
}

/** At most this many named slices; the rest becomes one "Sonstiges" slice. */
export const MAX_SEGMENTS = 6;

const usable = (v: number) => Number.isFinite(v) && v > 0;

/**
 * Sorts by size (largest first, ties keep input order) and folds everything after `max` (at most six: one colour
 * and pattern slot each) into one slice named `otherLabel` on the grey "other" slot. A rest of exactly one value
 * keeps its own name on that slot (a "Sonstiges" of one thing hides a name for nothing). Zero, negative and
 * non-finite values have no share and are left out.
 */
export function foldShares(
  data: readonly ChartDatum[],
  otherLabel: string,
  max: number = MAX_SEGMENTS,
): Share[] {
  const rows = data
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => usable(d.value))
    .sort((a, b) => b.d.value - a.d.value || a.i - b.i);
  const total = rows.reduce((s, r) => s + r.d.value, 0);
  if (total <= 0) return [];
  const cap = Math.min(MAX_SEGMENTS, Math.max(1, Math.floor(max)));
  const named = rows.slice(0, cap);
  const rest = rows.slice(named.length);
  const shares: Share[] = named.map(({ d, i }, index) => ({
    key: d.id ?? `${i}`,
    label: d.label,
    value: d.value,
    share: d.value / total,
    index,
    other: false,
  }));
  if (rest.length > 0) {
    const value = rest.reduce((s, r) => s + r.d.value, 0);
    shares.push({
      key: rest.length === 1 ? (rest[0]!.d.id ?? `${rest[0]!.i}`) : '__other',
      label: rest.length === 1 ? rest[0]!.d.label : otherLabel,
      value,
      share: value / total,
      index: shares.length,
      other: true,
    });
  }
  return shares;
}

/** "42 %" in the app's number format; a share that is there but rounds to 0 reads "< 1 %", never "0 %". */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.005)
    return `< ${formatNumber(0.01, { style: 'percent', maximumFractionDigits: 0 })}`;
  return formatNumber(share, { style: 'percent', maximumFractionDigits: 0 });
}

/** A "nice" step (1, 2, 2.5, 5 × 10ⁿ) near `raw`. */
function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * Value axis for `values`: round bounds and about `count` ticks. `zero` pulls 0 into the range (bars and areas
 * always start at zero, a line may not: a small change in a large balance stays visible). A flat series gets room
 * above and below so it sits mid-height instead of on an edge.
 */
export function niceScale(
  values: readonly number[],
  { zero = false, count = 4 }: { zero?: boolean; count?: number } = {},
): Scale {
  const finite = values.filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 0;
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    // With `zero` this is only possible when every value is 0.
    const pad = Math.abs(hi) * 0.1 || 1;
    if (zero) hi = 1;
    else {
      lo -= pad;
      hi += pad;
    }
  }
  const step = niceStep((hi - lo) / Math.max(1, count - 1));
  const min = Number((Math.floor(lo / step + 1e-9) * step).toPrecision(12));
  const max = Number((Math.ceil(hi / step - 1e-9) * step).toPrecision(12));
  const ticks: number[] = [];
  for (let k = 0; min + k * step <= max + step / 2; k++) {
    const v = Number((min + k * step).toPrecision(12));
    ticks.push(v === 0 ? 0 : v);
  }
  return { min, max, ticks };
}

/** Position of `v` on the scale, 0 (bottom) … 1 (top), clamped. */
export function fraction(v: number, scale: Pick<Scale, 'min' | 'max'>): number {
  const span = scale.max - scale.min || 1;
  return Math.min(1, Math.max(0, (v - scale.min) / span));
}

/**
 * Which of `n` category labels to print so that at most `max` show: every `step`-th, counted back from the last
 * (the latest month is the one people look for), so the last label always shows.
 */
export function labelIndexes(n: number, max: number): Set<number> {
  const step = Math.max(1, Math.ceil(n / Math.max(1, max)));
  const out = new Set<number>();
  for (let i = n - 1; i >= 0; i -= step) out.add(i);
  return out;
}

/**
 * SVG path through the points of `values` on a 0…100 × 0…100 box (x by index, y from `scale`, top = 0). `null` and
 * non-finite values leave a gap: the line stops and starts again, it never draws a value that is not there.
 */
export function linePath(
  values: readonly (number | null)[],
  scale: Pick<Scale, 'min' | 'max'>,
): string {
  const n = values.length;
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    const x = n === 1 ? 50 : (i / (n - 1)) * 100;
    const y = 100 - fraction(v, scale) * 100;
    d += `${pen ? 'L' : 'M'}${round(x)} ${round(y)}`;
    pen = true;
  });
  return d;
}

/** Closed area under the path down to `base` (0 when the scale holds it): one shape per unbroken run of values. */
export function areaPath(
  values: readonly (number | null)[],
  scale: Pick<Scale, 'min' | 'max'>,
): string {
  const n = values.length;
  const baseY = round(100 - fraction(Math.max(scale.min, Math.min(0, scale.max)), scale) * 100);
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ i, v });
  });
  if (run.length) runs.push(run);
  return runs
    .filter((r) => r.length > 1)
    .map((r) => {
      const pts = r.map(({ i, v }) => {
        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
        return `${round(x)} ${round(100 - fraction(v, scale) * 100)}`;
      });
      const x0 = pts[0]!.split(' ')[0];
      const x1 = pts[pts.length - 1]!.split(' ')[0];
      return `M${x0} ${baseY}L${pts.join('L')}L${x1} ${baseY}Z`;
    })
    .join('');
}

/** Last finite value of a series and its index, or `null` when there is none. */
export function lastValue(values: readonly (number | null)[]): { i: number; v: number } | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return { i, v };
  }
  return null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Where each share sits on a ring measured in percent of its circumference: `start` and `length`, minus a `gap`
 * between slices (none for a single slice, which closes the ring).
 */
export function arcs<T extends { share: number }>(
  shares: readonly T[],
  gap: number,
): (T & { start: number; length: number })[] {
  const g = shares.length > 1 ? gap : 0;
  const out: (T & { start: number; length: number })[] = [];
  let at = 0;
  for (const s of shares) {
    out.push({ ...s, start: at, length: Math.max(0.0001, s.share * 100 - g) });
    at += s.share * 100;
  }
  return out;
}
