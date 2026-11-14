// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS_WAIT_MS } from '@/core/status/settled';
import { useFirstReadHold } from './firstReadHold';

describe('first-read hold (0b-8, identity.notice and identity.firstRead)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not hold a route without a hint to wait for', () => {
    const { result } = renderHook(() => useFirstReadHold(undefined));
    expect(result.current[0]).toBe(false);
  });

  it('holds from the first render until the page says its read is back', () => {
    const { result } = renderHook(() => useFirstReadHold('/weather'));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });

  it('shows head and page after the bound when the read hangs', () => {
    const { result } = renderHook(() => useFirstReadHold('/weather'));
    act(() => vi.advanceTimersByTime(STATUS_WAIT_MS - 1));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it('holds again at once for a new route inside the same frame', () => {
    const { result, rerender } = renderHook(({ key }) => useFirstReadHold(key), {
      initialProps: { key: '/weather' as string | undefined },
    });
    act(() => result.current[1]());
    rerender({ key: undefined });
    expect(result.current[0]).toBe(false);
    rerender({ key: '/weather' });
    expect(result.current[0]).toBe(true);
  });
});
