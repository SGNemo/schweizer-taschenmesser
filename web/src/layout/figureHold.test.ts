// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIGURE_HOLD_MS, useFigureHold } from './figureHold';

describe('figure hold (U01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds from the first render until the page has been there for the hold time', () => {
    const { result } = renderHook(() => useFigureHold('/people@wide'));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS));
    expect(result.current[0]).toBe(false);
  });

  it('holds again at once when the route changes inside the same frame (no fallback, cached chunk)', () => {
    const { result, rerender } = renderHook(({ key }) => useFigureHold(key), {
      initialProps: { key: '/people@wide' },
    });
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS));
    expect(result.current[0]).toBe(false);
    // The new route's first render already holds: nothing measures it before its page filled the row.
    rerender({ key: '/people/:id@wide' });
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS - 1));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it('holds again on the way back to a route whose hold had run out (A → B → A within the hold)', () => {
    const { result, rerender } = renderHook(({ key }) => useFigureHold(key), {
      initialProps: { key: '/people@wide' },
    });
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS));
    expect(result.current[0]).toBe(false);
    rerender({ key: '/people@phone' });
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS / 2));
    rerender({ key: '/people@wide' });
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS));
    expect(result.current[0]).toBe(false);
  });

  it('a loading chunk holds until it arrived, then the hold time runs', () => {
    const { result } = renderHook(() => useFigureHold('/budgets@wide'));
    act(() => result.current[1](true));
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS * 3));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(FIGURE_HOLD_MS));
    expect(result.current[0]).toBe(false);
  });
});
