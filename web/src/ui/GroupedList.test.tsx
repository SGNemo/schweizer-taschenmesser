// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { GroupedList } from './GroupedList';

const groups = [{ id: 'a', label: 'Nachrichten', count: 1, children: <p>Tagesschau</p> }];

describe('GroupedList forceOpen', () => {
  beforeEach(() => {
    act(() => useUiStore.setState({ closedGroups: ['t-force:a'] }));
  });

  it('shows a group folded earlier while forced open (search hits) and leaves the stored fold alone', async () => {
    const user = userEvent.setup();
    const view = render(<GroupedList listId="t-force" groups={groups} forceOpen />);
    expect(screen.getByText('Tagesschau')).toBeVisible();
    // Folding during the search is local: the stored choice stays as it was.
    await user.click(screen.getByRole('button', { name: /Nachrichten/ }));
    expect(screen.getByText('Tagesschau')).not.toBeVisible();
    expect(useUiStore.getState().closedGroups).toEqual(['t-force:a']);
    await user.click(screen.getByRole('button', { name: /Nachrichten/ }));
    expect(screen.getByText('Tagesschau')).toBeVisible();
    // Without a search the stored fold applies again.
    view.rerender(<GroupedList listId="t-force" groups={groups} />);
    expect(screen.getByText('Tagesschau')).not.toBeVisible();
    expect(useUiStore.getState().closedGroups).toEqual(['t-force:a']);
  });
});
