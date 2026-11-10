/**
 * Numbers of the remote control's latency probe (Dev-Preview only, `pages/settings/RemoteLatencyProbe`).
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

/**
 * One trip phone → PC, guessed from the time a session takes to open: TCP, the handshake and
 * `open`/`opened` are three exchanges, so six trips. A guess – the open also holds the PC's work.
 */
export const TRIPS_PER_OPEN = 6;
/** What the PC needs to open, check and apply one record (measured in the prototype: < 1 ms). */
export const PC_MS = 1;
/** The goal for our part: pointer event in the page → applied on the PC, at p95. */
export const GOAL_MS = 30;

/**
 * Our part at p95, from what the phone can measure alone: one `invoke` per event (p95) + one
 * trip (the open's p95 spread over its trips) + the PC. `undefined` until both were measured.
 */
export function ourPart(
  invoke: Summary | undefined,
  open: Summary | undefined,
): number | undefined {
  if (!invoke || !open) return undefined;
  return round(invoke.p95 + open.p95 / TRIPS_PER_OPEN + PC_MS);
}

/** One line to copy: numbers only, nothing about the device, the PC or the network. */
export function resultLine(parts: {
  input?: Summary;
  invoke?: Summary;
  open?: Summary;
  eventsPerSecond?: number;
  overlapPercent?: number;
  failedOpens?: number;
}): string {
  const s = (name: string, x?: Summary) =>
    x ? `${name} n=${x.n} min=${x.min} p50=${x.p50} p95=${x.p95} max=${x.max}` : `${name} –`;
  const our = ourPart(parts.invoke, parts.open);
  return [
    'nemo-remote-latency v1',
    s('input', parts.input),
    s('invoke', parts.invoke),
    `events/s=${parts.eventsPerSecond ?? '–'}`,
    `overlap%=${parts.overlapPercent ?? '–'}`,
    s('open', parts.open),
    `failedOpens=${parts.failedOpens ?? 0}`,
    `ourPartP95≈${our ?? '–'}`,
  ].join(' | ');
}
