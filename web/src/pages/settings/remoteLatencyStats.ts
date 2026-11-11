/**
 * Numbers of the remote control's latency probe (Dev-Preview only, `RemoteLatencyProbe`).
 * Pure; nothing here measures, stores or sends.
 */

export interface Summary {
  n: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
}

/** Nearest-rank percentile of an ascending list. */
const rank = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;

const round = (ms: number): number => Math.round(ms * 10) / 10;

/** `undefined` without a sample. Values in ms, rounded to a tenth. */
export function summarise(samples: readonly number[]): Summary | undefined {
  const sorted = samples.filter((s) => Number.isFinite(s) && s >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  return {
    n: sorted.length,
    min: round(sorted[0]!),
    p50: round(rank(sorted, 50)),
    p95: round(rank(sorted, 95)),
    max: round(sorted[sorted.length - 1]!),
  };
}

/** An open is three exchanges – TCP, the handshake, `open`/`opened` – so six trips. */
export const TRIPS_PER_OPEN = 6;
/** What the PC needs to open, check and apply one record (prototype: < 1 ms). */
export const PC_MS = 1;
/** The goal for our part: pointer event in the page → applied on the PC, at p95. */
export const GOAL_MS = 30;

/**
 * One trip phone → PC at its best, estimated: the fastest open spread over its trips. The fastest
 * open is used because a slow one says nothing about a pointer stream (the first reads keys and
 * wakes the Wi-Fi, the PC may wait for a fresh state). The estimate is **too high rather than
 * too low**: every open also reads two keys on the phone and does the key agreement on both
 * sides, which can be as much per "trip" as the trip itself (see [`CLOSE_MS`]).
 */
export function tripEstimate(open: Summary | undefined): number | undefined {
  return open ? round(open.min / TRIPS_PER_OPEN) : undefined;
}

/** How far the opens scatter (p95 − p50): the Wi-Fi's mood, shown on its own, never divided. */
export function spread(open: Summary | undefined): number | undefined {
  return open ? round(open.p95 - open.p50) : undefined;
}

/**
 * How much the trip estimate is assumed to be too high (key reads in every open, spread over six
 * trips) – an assumption, not a measurement: an invoke this far over its budget is "close", not
 * "too expensive".
 */
export const CLOSE_MS = 3;
/** Below this many calls a p95 is just the slowest one: no verdict (about a second of circling). */
export const MIN_INVOKES = 100;

/**
 * What one `invoke` per event may cost at p95: the goal minus one trip (estimated) and the PC.
 * The question the probe answers is this one – WebView or touch capture in the Kotlin plugin –
 * because either way crosses the same Wi-Fi. Three leanings: the trip estimate is too high
 * (budget too small, by about [`CLOSE_MS`] as an assumption) and the measured invoke is a round
 * trip where a move needs one direction (both make the verdict stricter); and the trip is the
 * best one, not a typical one, held against a p95 (which makes it more generous).
 */
export function invokeBudget(open: Summary | undefined): number | undefined {
  const trip = tripEstimate(open);
  return trip === undefined ? undefined : round(GOAL_MS - trip - PC_MS);
}

export type Verdict = 'fits' | 'close' | 'over' | 'few';

/**
 * `undefined` until both were measured; `few` = too few calls for a p95. `close` = measure again
 * and try by hand, not the fallback.
 */
export function verdict(
  invoke: Summary | undefined,
  open: Summary | undefined,
): Verdict | undefined {
  const budget = invokeBudget(open);
  if (!invoke || budget === undefined) return undefined;
  if (invoke.n < MIN_INVOKES) return 'few';
  if (invoke.p95 <= budget) return 'fits';
  return invoke.p95 <= budget + CLOSE_MS ? 'close' : 'over';
}

/** One line to copy: numbers and error codes only, nothing about the device, the PC or the network. */
export function resultLine(parts: {
  input?: Summary;
  invoke?: Summary;
  open?: Summary;
  eventsPerSecond?: number;
  overlapPercent?: number;
  failed?: Readonly<Record<string, number>>;
}): string {
  const s = (name: string, x?: Summary) =>
    x ? `${name} n=${x.n} min=${x.min} p50=${x.p50} p95=${x.p95} max=${x.max}` : `${name} –`;
  const failed = Object.entries(parts.failed ?? {})
    .map(([code, n]) => `${code}:${n}`)
    .join(',');
  return [
    'nemo-remote-latency v3',
    s('input', parts.input),
    s('invoke', parts.invoke),
    `events/s=${parts.eventsPerSecond ?? '–'}`,
    `overlap%=${parts.overlapPercent ?? '–'}`,
    s('open', parts.open),
    `failed=${failed || '0'}`,
    `trip≈${tripEstimate(parts.open) ?? '–'}`,
    `spread=${spread(parts.open) ?? '–'}`,
    `invokeBudget=${invokeBudget(parts.open) ?? '–'}`,
    `verdict=${verdict(parts.invoke, parts.open) ?? '–'}`,
  ].join(' | ');
}
