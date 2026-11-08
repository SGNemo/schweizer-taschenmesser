// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { Toaster } from './Misc';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ toasts: [], toastStay: false });
});
afterEach(() => {
  vi.useRealTimers();
  useUiStore.setState({ toasts: [] });
});

describe('toasts', () => {
  it('show one notice at a time; a new one replaces the old', () => {
    const { toast } = useUiStore.getState();
    act(() => {
      toast('eins');
      toast('zwei');
      toast('drei');
    });
    expect(useUiStore.getState().toasts.map((x) => x.message)).toEqual(['drei']);
  });

  it('a toast disappears after 6 s; a replacement starts its own clock', () => {
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('alt');
    });
    act(() => {
      vi.advanceTimersByTime(4000);
      useUiStore.getState().toast('neu');
    });
    act(() => {
      vi.advanceTimersByTime(2100); // 'alt' would be 6.1 s old, 'neu' only 2.1 s
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

  it('A04: waits while the pointer or the focus is in the toast, then gets 6 s again', () => {
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('Erledigt.', { label: 'Rückgängig', run: () => {} });
    });
    const undo = screen.getByRole('button', { name: 'Rückgängig' });
    act(() => {
      fireEvent.focusIn(undo);
    });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByText('Erledigt.')).toBeVisible();
    act(() => {
      fireEvent.focusOut(undo);
      fireEvent.pointerEnter(undo.parentElement!);
    });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByText('Erledigt.')).toBeVisible();
    act(() => {
      fireEvent.pointerLeave(undo.parentElement!);
    });
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(screen.getByText('Erledigt.')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Erledigt.')).toBeNull();
  });

  it('A04: with "Hinweise bleiben stehen" a toast stays until closed', () => {
    useUiStore.setState({ toastStay: true });
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('ToDo hinzugefügt.');
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('ToDo hinzugefügt.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText('ToDo hinzugefügt.')).toBeNull();
  });

  it('council F1: a staying toast with an action can still be closed without undoing', () => {
    useUiStore.setState({ toastStay: true });
    const run = vi.fn();
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('ToDo hinzugefügt.', { label: 'Rückgängig', run });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByText('ToDo hinzugefügt.')).toBeNull();
  });

  it('council F2: a toast replaced while held does not hold the next one', () => {
    render(<Toaster />);
    act(() => {
      useUiStore.getState().toast('eins');
    });
    act(() => {
      fireEvent.pointerEnter(screen.getByText('eins').parentElement!);
    });
    act(() => {
      useUiStore.getState().toast('zwei'); // replaces 'eins' (one toast at a time), no pointerleave
    });
    act(() => {
      vi.advanceTimersByTime(6100);
    });
    expect(screen.queryByText('zwei')).toBeNull();
  });
});
