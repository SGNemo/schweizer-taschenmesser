import type { Scan } from './util';

/**
 * "14:00 bis 16:00", "6 bis 14:30", "10–12 Uhr", "von 21:30 bis 06:30". One side needs a colon or
 * "Uhr", otherwise "3-5 Tage" or "1 bis 2 Äpfel" would be read as clock times.
 */
const RANGE_RE =
  /(?<![\d.,:])(?:von\s+|ab\s+|um\s+)?(\d{1,2})(?::(\d{2}))?(\s*uhr)?\s*(?:–|—|-|bis)\s*(\d{1,2})(?::(\d{2}))?(\s*uhr)?(?![\d:]|[.,]\d|\p{L})/iu;

const ok = (h: number, m: number): boolean => h >= 0 && h <= 23 && m >= 0 && m <= 59;

/**
 * Cuts the end of a time range out of `s` and leaves the start behind as "H[:mm] Uhr" for the
 * clock-time extractor. Returns the end as 'HH:mm'.
 */
export function extractEndTime(s: Scan): string | undefined {
  const m = RANGE_RE.exec(s.t);
  if (!m || !(m[2] || m[3] || m[5] || m[6])) return undefined;
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] ?? 0), Number(m[4]), Number(m[5] ?? 0)];
  if (!ok(h1, m1) || !ok(h2, m2)) return undefined;
  const start = `${m[1]}${m[2] ? `:${m[2]}` : ''} Uhr`;
  s.t = `${s.t.slice(0, m.index)} ${start} ${s.t.slice(m.index + m[0].length)}`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h2)}:${p(m2)}`;
}
