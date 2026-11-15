// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import type { NowPlayingHandle } from '../useNowPlaying';
import {
  SLEEP_KEY,
  currentSleep,
  forgetSleep,
  setSleep,
  sleepEnd,
  useSleepWatcher,
} from '../sleepTimer';

const T0 = 1_800_000_000_000;
let clock = T0;
const handle = (playing = true) => {
  const control = vi.fn(async () => {});
  return {
    control,
    np: {
      canControl: true,
      current: { title: 't', artist: 'a', playing },
      control,
    } as unknown as NowPlayingHandle,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  clock = T0;
  setNow(() => clock);
  localStorage.clear();
  forgetSleep();
});
afterEach(() => {
  forgetSleep();
  setNow(undefined);
  vi.useRealTimers();
});

describe('sleepEnd', () => {
  it('n minutes from now, or what is left of the song (minus the time since it was read)', () => {
    expect(sleepEnd(15)).toEqual({ at: T0 + 15 * 60_000, mode: 'time' });
    expect(
      sleepEnd('track', {
        progressMs: 50_000,
        durationMs: 200_000,
        readAt: T0 - 10_000,
        playing: true,
      }),
    ).toEqual({ at: T0 + 140_000, mode: 'track' });
    // A paused song has no end in sight.
    expect(
      sleepEnd('track', { progressMs: 50_000, durationMs: 200_000, readAt: T0, playing: false }),
    ).toBeUndefined();
    expect(sleepEnd('track', { durationMs: 200_000, readAt: T0 })).toBeUndefined();
  });
});

describe('the timer', () => {
  it('pauses at the end while the music plays, then it is gone', () => {
    const { np, control } = handle();
    setSleep(sleepEnd(15));
    renderHook(() => useSleepWatcher(np));
    clock += 15 * 60_000 - 1;
    act(() => void vi.advanceTimersByTime(15 * 60_000 - 1));
    expect(control).not.toHaveBeenCalled();
    clock += 1;
    act(() => void vi.advanceTimersByTime(1));
    expect(control).toHaveBeenCalledExactlyOnceWith('pause');
    expect(currentSleep()).toBeUndefined();
    expect(localStorage.getItem(SLEEP_KEY)).toBeNull();
  });

  it('two players on screen arm one timer: one pause', () => {
    const a = handle();
    const b = handle();
    setSleep(sleepEnd(15));
    renderHook(() => useSleepWatcher(a.np));
    renderHook(() => useSleepWatcher(b.np));
    act(() => void vi.advanceTimersByTime(15 * 60_000));
    expect(a.control.mock.calls.length + b.control.mock.calls.length).toBe(1);
  });

  it('nothing plays at the end: no command', () => {
    const { np, control } = handle(false);
    setSleep(sleepEnd(15));
    renderHook(() => useSleepWatcher(np));
    act(() => void vi.advanceTimersByTime(15 * 60_000));
    expect(control).not.toHaveBeenCalled();
  });

  it('switched off before the end: nothing happens', () => {
    const { np, control } = handle();
    setSleep(sleepEnd(15));
    renderHook(() => useSleepWatcher(np));
    act(() => setSleep(undefined));
    act(() => void vi.advanceTimersByTime(20 * 60_000));
    expect(control).not.toHaveBeenCalled();
  });

  it('an end that passed while Nemo was closed is dropped, never acted on later', () => {
    localStorage.setItem(SLEEP_KEY, JSON.stringify({ at: T0 - 5 * 60_000, mode: 'time' }));
    forgetSleep();
    const { np, control } = handle();
    renderHook(() => useSleepWatcher(np));
    act(() => void vi.advanceTimersByTime(1000));
    expect(control).not.toHaveBeenCalled();
    expect(localStorage.getItem(SLEEP_KEY)).toBeNull();
  });

  it('an end only seconds past when Nemo opens again is dropped too', () => {
    localStorage.setItem(SLEEP_KEY, JSON.stringify({ at: T0 - 10_000, mode: 'time' }));
    forgetSleep();
    const { np, control } = handle();
    renderHook(() => useSleepWatcher(np));
    act(() => void vi.advanceTimersByTime(1000));
    expect(control).not.toHaveBeenCalled();
    expect(currentSleep()).toBeUndefined();
  });

  it('a timeout that fires far too late (the computer slept) does not pause', () => {
    const { np, control } = handle();
    setSleep(sleepEnd(15));
    renderHook(() => useSleepWatcher(np));
    clock += 60 * 60_000;
    act(() => void vi.advanceTimersByTime(15 * 60_000));
    expect(control).not.toHaveBeenCalled();
    expect(currentSleep()).toBeUndefined();
  });

  it('a timer set before a reload is armed again', () => {
    localStorage.setItem(SLEEP_KEY, JSON.stringify({ at: T0 + 60_000, mode: 'time' }));
    forgetSleep();
    const { np, control } = handle();
    renderHook(() => useSleepWatcher(np));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(control).toHaveBeenCalledWith('pause');
  });
});
