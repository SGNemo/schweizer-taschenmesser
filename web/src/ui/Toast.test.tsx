// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { Toaster } from './Misc';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  vi.useRealTimers();
  useUiStore.setState({ toasts: [] });
});

describe('toasts', () => {
  it('stack at most two; a third pushes the oldest out', () => {
    const { toast } = useUiStore.getState();
    act(() => {
      toast('eins');
      toast('zwei');
      toast('drei');
    });
    expect(useUiStore.getState().toasts.map((x) => x.message)).toEqual(['zwei', 'drei']);
  });

  it('each toast disappears after 6 s on its own clock', () => {
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('alt');
    });
    act(() => {
      vi.advanceTimersByTime(4000);
      useUiStore.getState().toast('neu');
    });
    act(() => {
      vi.advanceTimersByTime(2100); // 'alt' is 6.1 s old, 'neu' only 2.1 s
    });
    expect(screen.queryByText('alt')).toBeNull();
    expect(screen.getByText('neu')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('neu')).toBeNull();
  });

  it('the action runs and closes the toast', () => {
    const run = vi.fn();
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('Erledigt.', { label: 'Rückgängig', run });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByText('Erledigt.')).toBeNull();
  });
});
