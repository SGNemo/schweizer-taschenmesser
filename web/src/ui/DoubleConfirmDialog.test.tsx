// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoubleConfirmDialog } from './SettingsParts';

describe('DoubleConfirmDialog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the action only on a second, separate confirmation', async () => {
    const onConfirm = vi.fn();
    render(
      <DoubleConfirmDialog
        open
        onClose={() => undefined}
        title="Alles löschen?"
        confirmLabel="Endgültig löschen"
        onConfirm={onConfirm}
      >
        <p>Erfundener Hinweis</p>
      </DoubleConfirmDialog>,
    );
    const button = () => screen.getByRole('button', { name: 'Endgültig löschen', hidden: true });
    // First click only asks again.
    fireEvent.click(button());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-again').textContent).toContain('Bist du sicher?');
    // A hasty second click is ignored: the button is off for a moment.
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button());
    expect(onConfirm).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect((button() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button());
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('"Zurück" goes back without doing anything', () => {
    const onConfirm = vi.fn();
    render(
      <DoubleConfirmDialog
        open
        onClose={() => undefined}
        title="T"
        confirmLabel="Ja"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ja', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück', hidden: true }));
    expect(screen.queryByTestId('confirm-again')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
