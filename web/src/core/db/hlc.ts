/**
 * Hybrid Logical Clock. Stamps are sortable strings:
 *   "<wallMs, 13 digits>-<counter, 4 digits>-<deviceId>"
 * Lexicographic order == causal order; the device id is a deterministic tie-break.
 */
import { now } from '@/core/time/now';

export interface ParsedHlc {
  wall: number;
  counter: number;
  deviceId: string;
}

const MAX_COUNTER = 9999;
/**
 * Stamps further than this ahead of the local clock are refused at the sync boundary (pull in
 * `core/sync/engine.ts`, push on the server). Without a bound, one far-future stamp from any device
 * or the server would be adopted by every device for good and its field could never be overwritten
 * again. The clock itself still adopts anything already stored locally, so a restore or a repair
 * can always beat a stamp that slipped in earlier.
 */
export const MAX_HLC_DRIFT_MS = 60 * 60 * 1000;

/** True when the stamp's wall time lies beyond the drift bound relative to `at` (default: now). */
export function isHlcTooFarAhead(hlc: string, at: number = now()): boolean {
  const m = /^(\d{13})-/.exec(hlc);
  return m !== null && Number(m[1]) > at + MAX_HLC_DRIFT_MS;
}

export function formatHlc(wall: number, counter: number, deviceId: string): string {
  return `${String(wall).padStart(13, '0')}-${String(counter).padStart(4, '0')}-${deviceId}`;
}

export function parseHlc(hlc: string): ParsedHlc {
  const m = /^(\d{13})-(\d{4})-(.+)$/.exec(hlc);
  if (!m) throw new Error(`Invalid HLC: ${hlc}`);
  return { wall: Number(m[1]), counter: Number(m[2]), deviceId: m[3]! };
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxHlc(stamps: Iterable<string>): string | undefined {
  let best: string | undefined;
  for (const s of stamps) if (best === undefined || s > best) best = s;
  return best;
}

export interface HlcClock {
  /** Produce a stamp for a local event. Strictly greater than every earlier stamp/receive. */
  tick(): string;
  /** Observe a remote (or previously stored) stamp so later ticks sort after it. */
  receive(remote: string): void;
}

export function createClock(deviceId: string): HlcClock {
  let wall = 0;
  let counter = 0;

  return {
    tick() {
      const physical = now();
      if (physical > wall) {
        wall = physical;
        counter = 0;
      } else if (counter >= MAX_COUNTER) {
        // Counter exhausted within one millisecond: borrow from the next millisecond.
        wall += 1;
        counter = 0;
      } else {
        counter += 1;
      }
      return formatHlc(wall, counter, deviceId);
    },
    receive(remote) {
      const p = parseHlc(remote);
      // Only move forward; the next tick() then sorts strictly after `remote`.
      if (p.wall > wall || (p.wall === wall && p.counter > counter)) {
        wall = p.wall;
        counter = p.counter;
      }
    },
  };
}
