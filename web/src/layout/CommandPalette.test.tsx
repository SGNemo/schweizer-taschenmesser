import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { CommandPalette, filterCommands, normalize } from './CommandPalette';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

beforeEach(() => useUiStore.setState({ paletteOpen: true }));

describe('command palette', () => {
  it('normalizes diacritics and case', () => {
    expect(normalize('  Übersicht ')).toBe('ubersicht');
  });

  it('filters commands', () => {
    const cmds = [
      { id: 'a', label: 'Einstellungen', icon: 'settings' as const, run: () => undefined },
      { id: 'b', label: 'Kalender', icon: 'calendar' as const, run: () => undefined },
    ];
    expect(filterCommands(cmds, 'kal').map((c) => c.id)).toEqual(['b']);
    expect(filterCommands(cmds, '')).toHaveLength(2);
  });

  it('navigates with the keyboard and closes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Where />
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'einst{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/settings');
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it('shows an empty state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'zzzzz');
    expect(screen.getByText(t.palette.empty)).toBeInTheDocument();
  });
});
