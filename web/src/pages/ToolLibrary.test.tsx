// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { tLibraryV3 } from '@/strings.libraryV3';
import { ToolLibrary } from './ToolLibrary';

describe('ToolLibrary', () => {
  it('has the head with figures and the filter; a tool switched under a filter stays until the filter changes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToolLibrary />
      </MemoryRouter>,
    );
    // Library bands are neutral (identity v3.1, C28): no module hue on a catalogue head.
    expect(await screen.findByTestId('tools-head')).toHaveAttribute('data-hue', 'slate');
    const f = tLibraryV3.get().filter;
    await user.click(screen.getByRole('button', { name: f.active }));
    // a tool that is on by default
    const card = within(await screen.findByTestId('tool-calc'));
    const sw = card.getByRole('switch');
    await waitFor(() => expect(sw).toBeEnabled());
    await user.click(sw);
    await waitFor(() => expect(sw).not.toBeChecked());
    // off now, so it no longer matches "Aktiv", but its card is held
    expect(screen.getByTestId('tool-calc')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: f.all }));
    await user.click(screen.getByRole('button', { name: f.active }));
    await waitFor(() => expect(screen.queryByTestId('tool-calc')).not.toBeInTheDocument());
  });
});
