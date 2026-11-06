import { NUM_SRC, NUMBER_WORDS, take, type Scan } from './util';

/**
 * "15 min", "15min", "30 Minuten", "1 Std", "1h", "1,5 h", "zwei Stunden", "eine halbe Stunde";
 * capped like the ToDo field (1–480 min).
 */
const ESTIMATE_RE = new RegExp(
  String.raw`(?:^|(?<=\s))(?:ca\.?\s*|etwa\s*|~\s*)?(\d{1,3}|anderthalb|eineinhalb|halbe|${NUM_SRC})(?:\s*(min(?:uten)?\.?)|(?:[.,](\d))?\s*(std\.?|stunden?|h))(?=$|[\s,.;:!?])`,
  'i',
);

const HALVES: Record<string, number> = { anderthalb: 1.5, eineinhalb: 1.5, halbe: 0.5 };

const amountOf = (s: string): number => {
  const w = s.toLowerCase();
  return HALVES[w] ?? NUMBER_WORDS[w] ?? Number(s);
};

/**
 * Pulls an effort estimate out of the text. Run it after the date/time extraction so that
 * "in 45 Minuten" (a time) is already gone. Returns minutes, or `undefined` when nothing matches.
 */
export function extractEstimate(scan: Scan): number | undefined {
  const m = ESTIMATE_RE.exec(scan.t);
  if (!m) return undefined;
  const whole = amountOf(m[1]!);
  const minutes = m[2] ? whole : Math.round((whole + (m[3] ? Number(m[3]) / 10 : 0)) * 60);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) return undefined;
  take(scan, ESTIMATE_RE);
  return minutes;
}
