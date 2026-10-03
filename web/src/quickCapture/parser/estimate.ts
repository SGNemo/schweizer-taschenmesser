import { take, type Scan } from './util';

/** "15 min", "15min", "30 Minuten", "1 Std", "1h", "1,5 Std"; capped like the ToDo field (1–480 min). */
const ESTIMATE_RE =
  /(?:^|(?<=\s))(?:ca\.?\s*|etwa\s*|~\s*)?(\d{1,3})(?:\s*(min(?:uten)?\.?)|(?:[.,](\d))?\s*(std\.?|h))(?=$|[\s,.;:!?])/i;

/**
 * Pulls an effort estimate out of the text. Run it after the date/time extraction so that
 * "in 45 Minuten" (a time) is already gone. Returns minutes, or `undefined` when nothing matches.
 */
export function extractEstimate(scan: Scan): number | undefined {
  const m = ESTIMATE_RE.exec(scan.t);
  if (!m) return undefined;
  const whole = Number(m[1]);
  const minutes = m[2] ? whole : Math.round((whole + (m[3] ? Number(m[3]) / 10 : 0)) * 60);
  if (minutes < 1 || minutes > 480) return undefined;
  take(scan, ESTIMATE_RE);
  return minutes;
}
