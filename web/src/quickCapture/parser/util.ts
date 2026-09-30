/** Date/regex helpers for the parser. Calendar math runs at local noon to stay clear of DST edges. */

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export const fmtDate = (x: Ymd): string => `${x.y}-${pad(x.m)}-${pad(x.d)}`;
export const fmtTime = (h: number, min: number): string => `${pad(h)}:${pad(min)}`;
const toDate = (x: Ymd): Date => new Date(x.y, x.m - 1, x.d, 12);
export const fromDate = (d: Date): Ymd => ({
  y: d.getFullYear(),
  m: d.getMonth() + 1,
  d: d.getDate(),
});

export function addDays(x: Ymd, n: number): Ymd {
  const d = toDate(x);
  d.setDate(d.getDate() + n);
  return fromDate(d);
}

export function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export const cmpDate = (a: Ymd, b: Ymd): number => {
  const x = fmtDate(a);
  const y = fmtDate(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

/** ISO weekday, Mon = 1 … Sun = 7. */
export function isoWeekday(x: Ymd): number {
  const w = toDate(x).getDay();
  return w === 0 ? 7 : w;
}

/** Next date with the given ISO weekday; `includeToday` lets today count. */
export function nextWeekday(from: Ymd, weekday: number, includeToday: boolean): Ymd {
  let diff = (weekday - isoWeekday(from) + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(from, diff);
}

export function addMonths(x: Ymd, n: number): Ymd {
  const total = x.y * 12 + (x.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(y, m, 0, 12).getDate();
  return { y, m, d: Math.min(x.d, last) };
}

export const lastDayOfMonth = (y: number, m: number): number => new Date(y, m, 0, 12).getDate();

/** Unicode-aware word boundary (JS `\b` ignores umlauts). */
const LETTER = '[\\p{L}\\d]';
export const word = (src: string): RegExp =>
  new RegExp(`(?<!${LETTER})(?:${src})(?!${LETTER})`, 'iu');

/** Working text the extractors carve matches out of. */
export interface Scan {
  t: string;
}

/** Finds the first match, blanks it out of the scan and returns it. */
export function take(s: Scan, re: RegExp): RegExpExecArray | null {
  const m = re.exec(s.t);
  if (!m) return null;
  s.t = `${s.t.slice(0, m.index)} ${s.t.slice(m.index + m[0].length)}`;
  return m;
}
