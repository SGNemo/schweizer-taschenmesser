import { describe, expect, it } from 'vitest';
import { GOAL_MS, ourPart, resultLine, summarise } from './latencyStats';

describe('remote latency numbers', () => {
  it('summarises with nearest-rank percentiles and ignores broken samples', () => {
    expect(summarise([])).toBeUndefined();
    expect(summarise([Number.NaN, -1])).toBeUndefined();
    const s = summarise(Array.from({ length: 100 }, (_, i) => i + 1))!;
    expect(s).toEqual({ n: 100, min: 1, p50: 50, p95: 95, max: 100 });
    expect(summarise([3.14159])).toEqual({ n: 1, min: 3.1, p50: 3.1, p95: 3.1, max: 3.1 });
    expect(summarise([5, 1, Number.POSITIVE_INFINITY, 3])!.max).toBe(5);
  });

  it('our part is one invoke, one trip of six and the PC, only once both were measured', () => {
    const invoke = summarise([2, 2, 2, 4])!;
    const open = summarise([30, 36, 60])!;
    expect(ourPart(invoke, undefined)).toBeUndefined();
    expect(ourPart(undefined, open)).toBeUndefined();
    expect(ourPart(invoke, open)).toBe(15);
    expect(ourPart(invoke, open)!).toBeLessThan(GOAL_MS);
  });

  it('the line to copy holds numbers only', () => {
    const line = resultLine({
      invoke: summarise([2])!,
      open: summarise([30])!,
      eventsPerSecond: 118,
      overlapPercent: 3,
    });
    expect(line).toBe(
      'nemo-remote-latency v1 | input – | invoke n=1 min=2 p50=2 p95=2 max=2 | events/s=118 | overlap%=3 | open n=1 min=30 p50=30 p95=30 max=30 | failedOpens=0 | ourPartP95≈8',
    );
    expect(resultLine({})).toContain('ourPartP95≈–');
  });
});
