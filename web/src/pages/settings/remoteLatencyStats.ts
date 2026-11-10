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
 * One trip phone → PC at its best: the fastest open spread over its trips. A floor, and still
 * too high – an open also holds key reads on the phone and key agreement on both sides. The
 * fastest open is used because a slow one says nothing about a pointer stream (the first reads
 * keys and wakes the Wi-Fi, the PC may wait for a fresh state).
 */
export function tripFloor(open: Summary | undefined): number | undefined {
  return open ? round(open.min / TRIPS_PER_OPEN) : undefined;
}

/** How far the opens scatter (p95 − p50): the Wi-Fi's mood, shown on its own, never divided. */
export function spread(open: Summary | undefined): number | undefined {
  return open ? round(open.p95 - open.p50) : undefined;
}

/**
 * What one `invoke` per event may cost at p95: the goal minus one trip at its best and the PC.
 * The question the probe answers is this one – WebView or touch capture in the Kotlin plugin –
 * because either way crosses the same Wi-Fi.
 */
export function invokeBudget(open: Summary | undefined): number | undefined {
  const trip = tripFloor(open);
  return trip === undefined ? undefined : round(GOAL_MS - trip - PC_MS);
}

/** `undefined` until both were measured. */
export function fits(invoke: Summary | undefined, open: Summary | undefined): boolean | undefined {
  const budget = invokeBudget(open);
  return invoke && budget !== undefined ? invoke.p95 <= budget : undefined;
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
  const verdict = fits(parts.invoke, parts.open);
  return [
    'nemo-remote-latency v2',
    s('input', parts.input),
    s('invoke', parts.invoke),
    `events/s=${parts.eventsPerSecond ?? '–'}`,
    `overlap%=${parts.overlapPercent ?? '–'}`,
    s('open', parts.open),
    `failed=${failed || '0'}`,
    `trip≥${tripFloor(parts.open) ?? '–'}`,
    `spread=${spread(parts.open) ?? '–'}`,
    `invokeBudget=${invokeBudget(parts.open) ?? '–'}`,
    `fits=${verdict === undefined ? '–' : verdict ? 'yes' : 'no'}`,
  ].join(' | ');
}
