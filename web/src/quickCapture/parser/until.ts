import { extractDateTime, MONTH_SRC } from './dates';
import { fmtDate, type Scan } from './util';

const UNTIL_RE = new RegExp(
  String.raw`(?<![\p{L}\d])bis(?:\s+(?:zum|einschließlich))?\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\.\s?\d{1,2}\.(?:\s?\d{2,4})?(?![\d:])|\d{1,2}\.?\s*(?:${MONTH_SRC})\.?(?![\p{L}\d])(?:\s+\d{4})?)`,
  'iu',
);

/** "bis 31.12." / "bis zum 3. Januar 2027" next to a recurrence: the day it ends, 'YYYY-MM-DD'. */
export function extractUntil(s: Scan, now: Date): string | undefined {
  const m = UNTIL_RE.exec(s.t);
  if (!m) return undefined;
  const inner: Scan = { t: m[1]! };
  const { date } = extractDateTime(inner, now);
  if (!date) return undefined;
  s.t = `${s.t.slice(0, m.index)} ${s.t.slice(m.index + m[0].length)}`;
  return fmtDate(date);
}
