// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINUTE_MS, msToNextMinute, startMinuteTicker } from './minuteTicker';

describe('msToNextMinute', () => {
  it('counts to the next :00', () => {
    expect(msToNextMinute(Date.UTC(2026, 10, 9, 14, 7, 42, 500))).toBe(17_500);
    expect(msToNextMinute(Date.UTC(2026, 10, 9, 14, 7, 0, 0))).toBe(MINUTE_MS);
  });
});

describe('startMinuteTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 14, 7, 42, 500));
  });
  afterEach(() => vi.useRealTimers());

  it('ticks exactly at :00 and once per minute', () => {
    const ticks: number[] = [];
    const stop = startMinuteTicker((at) => ticks.push(at));
    vi.advanceTimersByTime(17_499);
    expect(ticks).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(ticks).toHaveLength(1);
    expect(new Date(ticks[0]!).getSeconds()).toBe(0);
    expect(new Date(ticks[0]!).getMinutes()).toBe(8);
    vi.advanceTimersByTime(3 * MINUTE_MS);
    expect(ticks.map((at) => new Date(at).getMinutes())).toEqual([8, 9, 10, 11]);
    expect(ticks.every((at) => at % MINUTE_MS === 0)).toBe(true);
    stop();
    vi.advanceTimersByTime(5 * MINUTE_MS);
    expect(ticks).toHaveLength(4);
  });

  it('ticks at once when the minute turned between render and start', () => {
    const ticks: number[] = [];
    const rendered = new Date(2026, 10, 9, 14, 6, 59, 999).getTime();
    const stop = startMinuteTicker((at) => ticks.push(at), rendered);
    expect(ticks.map((at) => new Date(at).getMinutes())).toEqual([7]);
    stop();
  });

  it('shows a changed minute at once when the page becomes visible again', () => {
    const ticks: number[] = [];
    const stop = startMinuteTicker((at) => ticks.push(at));
    // Asleep in the background: the clock moves on, the timer does not fire.
    vi.setSystemTime(new Date(2026, 10, 9, 14, 20, 5));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ticks.map((at) => new Date(at).getMinutes())).toEqual([20]);
    // Same minute again: nothing new to show.
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ticks).toHaveLength(1);
    vi.advanceTimersByTime(55_000);
    expect(ticks.map((at) => new Date(at).getMinutes())).toEqual([20, 21]);
    stop();
  });
});
