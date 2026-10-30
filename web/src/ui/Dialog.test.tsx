// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import { Dialog } from './Dialog';
import { DRAFT_TTL_MS, useDraft } from './useDraft';

afterEach(() => setNow());

describe('dialog', () => {
  it('closes straight away when nothing was typed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Neu">
        <input aria-label="Name" />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('asks before discarding a draft and keeps the fields when you go on editing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Neu" dirty>
        <input aria-label="Name" defaultValue="Anna" />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Entwurf verwerfen?')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(screen.queryByText('Entwurf verwerfen?')).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveValue('Anna');

    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('at the question, Esc and the X mean "keep editing"; only "Verwerfen" discards', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Neu" dirty>
        <input aria-label="Name" defaultValue="Anna" />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.getByText('Entwurf verwerfen?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText('Entwurf verwerfen?')).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveValue('Anna');
    expect(onClose).not.toHaveBeenCalled();

    // Esc reaches the dialog as the native `cancel` event (jsdom does not raise it by itself).
    const esc = () =>
      fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    esc();
    expect(screen.getByText('Entwurf verwerfen?')).toBeVisible();
    esc();
    expect(screen.queryByText('Entwurf verwerfen?')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a toggled checkbox is not a draft, typed text is', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Neu" askAfterTyping>
        <input aria-label="Name" />
        <input type="checkbox" aria-label="Erledigt" />
      </Dialog>,
    );
    await user.click(screen.getByLabelText('Erledigt'));
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();

    await user.type(screen.getByLabelText('Name'), 'A');
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByText('Entwurf verwerfen?')).toBeVisible();
  });

  it('shows what the caller puts before the title', () => {
    render(
      <Dialog
        open
        onClose={() => undefined}
        title="Werkzeuge"
        headerStart={<button>Zurück</button>}
      >
        <p>x</p>
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument();
  });
});

describe('useDraft', () => {
  it('restores a draft within 30 seconds, not later, and forgets it after clear()', () => {
    let t0 = 1_000_000;
    setNow(() => t0);
    const first = renderHook(() => useDraft('form-a', { name: '' }));
    act(() => first.result.current[1]({ name: 'Anna' }));
    first.unmount();

    t0 += DRAFT_TTL_MS - 1;
    const again = renderHook(() => useDraft('form-a', { name: '' }));
    expect(again.result.current[0]).toEqual({ name: 'Anna' });
    expect(again.result.current[3]).toBe(true);
    act(() => again.result.current[2]());
    again.unmount();

    const cleared = renderHook(() => useDraft('form-a', { name: '' }));
    expect(cleared.result.current[0]).toEqual({ name: '' });
    act(() => cleared.result.current[1]({ name: 'Bo' }));
    cleared.unmount();

    t0 += DRAFT_TTL_MS;
    const expired = renderHook(() => useDraft('form-a', { name: '' }));
    expect(expired.result.current[0]).toEqual({ name: '' });
    expect(expired.result.current[3]).toBe(false);
  });
});
