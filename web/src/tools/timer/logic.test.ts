import { describe, expect, it } from 'vitest';
import {
  clock,
  elapsed,
  finished,
  lapStopwatch,
  left,
  newCountdown,
  newStopwatch,
  nextPhase,
  pauseCountdown,
  pauseStopwatch,
  resetCountdown,
  startCountdown,
  startStopwatch,
} from './logic';

describe('countdown', () => {
  it('runs, pauses with the time left, resumes and finishes', () => {
    let c = startCountdown(newCountdown(60_000), 1_000);
    expect(left(c, 1_000)).toBe(60_000);
    expect(left(c, 11_000)).toBe(50_000);
    c = pauseCountdown(c, 11_000);
    expect(left(c, 99_000)).toBe(50_000); // paused: time does not pass
    c = startCountdown(c, 100_000);
    expect(left(c, 130_000)).toBe(20_000);
    expect(finished(c, 149_999)).toBe(false);
    expect(finished(c, 150_000)).toBe(true);
    expect(left(c, 999_999)).toBe(0);
  });

  it('restarts from the full duration once it has run out, and can be reset', () => {
    let c = startCountdown(newCountdown(5_000), 0);
    c = pauseCountdown(c, 9_000); // ran out while nobody looked
    expect(c.leftMs).toBe(0);
    expect(left(startCountdown(c, 20_000), 20_000)).toBe(5_000);
    expect(resetCountdown(c, 8_000)).toEqual({ durationMs: 8_000, leftMs: 8_000 });
  });

  it('ignores a second start', () => {
    const c = startCountdown(newCountdown(10_000), 0);
    expect(startCountdown(c, 5_000)).toBe(c);
  });
});

describe('stopwatch', () => {
  it('accumulates over pauses and records laps', () => {
    let s = startStopwatch(newStopwatch(), 1_000);
    expect(elapsed(s, 4_000)).toBe(3_000);
    s = lapStopwatch(s, 4_000);
    s = pauseStopwatch(s, 5_000);
    expect(elapsed(s, 50_000)).toBe(4_000);
    s = startStopwatch(s, 60_000);
    expect(elapsed(s, 62_000)).toBe(6_000);
    expect(s.laps).toEqual([3_000]);
    expect(lapStopwatch(pauseStopwatch(s, 62_000), 63_000).laps).toEqual([3_000]); // no laps while stopped
  });
});

describe('pomodoro and clock', () => {
  it('alternates work and rest and counts finished rounds', () => {
    expect(nextPhase('work', 1)).toEqual({ phase: 'rest', round: 1 });
    expect(nextPhase('rest', 1)).toEqual({ phase: 'work', round: 2 });
  });

  it('formats time; countdowns round up, stopwatches down', () => {
    expect(clock(61_000)).toBe('01:01');
    expect(clock(59_001)).toBe('01:00');
    expect(clock(3_725_000)).toBe('1:02:05');
    expect(clock(0)).toBe('00:00');
    expect(clock(1_999, true)).toBe('00:01');
  });
});
