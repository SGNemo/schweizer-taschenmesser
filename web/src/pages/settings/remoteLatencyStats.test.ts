import { describe, expect, it } from 'vitest';
import { fits, invokeBudget, resultLine, spread, summarise, tripFloor } from './remoteLatencyStats';

describe('remote latency numbers', () => {
  it('summarises with nearest-rank percentiles and ignores broken samples', () => {
    expect(summarise([])).toBeUndefined();
    expect(summarise([Number.NaN, -1])).toBeUndefined();
    const s = summarise(Array.from({ length: 100 }, (_, i) => i + 1))!;
    expect(s).toEqual({ n: 100, min: 1, p50: 50, p95: 95, max: 100 });
    expect(summarise([3.14159])).toEqual({ n: 1, min: 3.1, p50: 3.1, p95: 3.1, max: 3.1 });
    expect(summarise([5, 1, Number.POSITIVE_INFINITY, 3])!.max).toBe(5);
  });

  it('a trip is the fastest open over six, the spread is shown undivided', () => {
    const open = summarise([30, 36, 42, 200])!;
    expect(tripFloor(open)).toBe(5);
    expect(spread(open)).toBe(164);
    expect(tripFloor(undefined)).toBeUndefined();
    expect(spread(undefined)).toBeUndefined();
  });

  it('the invoke is judged against the goal minus one trip and the PC – a slow open does not eat it', () => {
    const open = summarise([30, 36, 42, 200])!;
    expect(invokeBudget(open)).toBe(24);
    expect(fits(summarise([2, 3, 24])!, open)).toBe(true);
    expect(fits(summarise([2, 3, 24.1])!, open)).toBe(false);
    expect(fits(summarise([2])!, undefined)).toBeUndefined();
    expect(fits(undefined, open)).toBeUndefined();
  });

  it('the line to copy holds numbers and error codes only', () => {
    const line = resultLine({
      invoke: summarise([2])!,
      open: summarise([30])!,
      eventsPerSecond: 118,
      overlapPercent: 3,
      failed: { network: 2, 'not-granted': 1 },
    });
    expect(line).toBe(
      'nemo-remote-latency v2 | input – | invoke n=1 min=2 p50=2 p95=2 max=2 | events/s=118 | overlap%=3 | open n=1 min=30 p50=30 p95=30 max=30 | failed=network:2,not-granted:1 | trip≥5 | spread=0 | invokeBudget=24 | fits=yes',
    );
    expect(resultLine({})).toContain('failed=0 | trip≥– | spread=– | invokeBudget=– | fits=–');
  });
});
