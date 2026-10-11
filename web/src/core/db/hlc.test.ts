import { afterEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import {
  compareHlc,
  createClock,
  formatHlc,
  isHlcTooFarAhead,
  MAX_HLC_DRIFT_MS,
  maxHlc,
  parseHlc,
} from './hlc';

afterEach(() => setNow());

describe('hlc', () => {
  it('formats and parses stamps', () => {
    const s = formatHlc(1_700_000_000_000, 7, 'dev1');
    expect(s).toBe('1700000000000-0007-dev1');
    expect(parseHlc(s)).toEqual({ wall: 1_700_000_000_000, counter: 7, deviceId: 'dev1' });
    expect(() => parseHlc('nope')).toThrow();
  });

  it('ticks strictly increase, even within the same millisecond', () => {
    setNow(() => 1_000_000_000_000);
    const c = createClock('a');
    const stamps = [c.tick(), c.tick(), c.tick()];
    expect([...stamps].sort()).toEqual(stamps);
    expect(new Set(stamps).size).toBe(3);
  });

  it('never goes backwards when the wall clock does', () => {
    let t = 2_000_000_000_000;
    setNow(() => t);
    const c = createClock('a');
    const first = c.tick();
    t -= 60_000;
    expect(compareHlc(c.tick(), first)).toBe(1);
  });

  it('sorts after a remote stamp that is ahead of local time (clock skew)', () => {
    setNow(() => 1_000_000_000_000);
    const remote = formatHlc(1_000_000_500_000, 3, 'other');
    const c = createClock('me');
    c.receive(remote);
    expect(compareHlc(c.tick(), remote)).toBe(1);
  });

  it('detects stamps beyond the drift bound, while the clock still beats stored ones', () => {
    const t = 1_000_000_000_000;
    setNow(() => t);
    const farFuture = formatHlc(t + MAX_HLC_DRIFT_MS + 1, 0, 'other');
    const withinBound = formatHlc(t + MAX_HLC_DRIFT_MS, 0, 'other');
    expect(isHlcTooFarAhead(farFuture, t)).toBe(true);
    expect(isHlcTooFarAhead(withinBound, t)).toBe(false);
    expect(isHlcTooFarAhead('garbage', t)).toBe(false);
    // A stamp that is already in the local database (restore, repair) must stay beatable.
    const c = createClock('me');
    c.receive(farFuture);
    expect(compareHlc(c.tick(), farFuture)).toBe(1);
  });

  it('uses the device id as deterministic tie-break', () => {
    const a = formatHlc(1_000_000_000_000, 0, 'aaaa');
    const b = formatHlc(1_000_000_000_000, 0, 'bbbb');
    expect(compareHlc(a, b)).toBe(-1);
    expect(maxHlc([a, b])).toBe(b);
    expect(maxHlc([])).toBeUndefined();
  });

  it('borrows from the next millisecond when the counter is exhausted', () => {
    setNow(() => 1_000_000_000_000);
    const c = createClock('a');
    let last = c.tick();
    for (let i = 0; i < 10_050; i++) {
      const next = c.tick();
      expect(compareHlc(next, last)).toBe(1);
      last = next;
    }
  });
});
