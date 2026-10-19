// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RowMenu } from './RowMenu';
import { GroupedList } from './GroupedList';

describe('RowMenu: checked entries', () => {
  it('marks the current choice with aria-checked, plain entries stay menuitems', async () => {
    const onSelect = vi.fn();
    render(
      <RowMenu
        label="Optionen"
        open
        onOpenChange={() => undefined}
        items={[
          { id: 'a', label: 'Alle', checked: true, onSelect },
          { id: 'b', label: 'Haushalt', checked: false, onSelect },
          { id: 'c', label: 'Neue Liste', onSelect },
        ]}
      />,
    );
    expect(screen.getByRole('menuitemcheckbox', { name: 'Alle' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: 'Haushalt' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('menuitem', { name: 'Neue Liste' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('menuitemcheckbox', { name: 'Haushalt' }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('GroupedList: group action', () => {
  it('renders the action at the top of the open group, before the rows', () => {
    render(
      <GroupedList
        listId="t"
        groups={[
          {
            id: 'overdue',
            label: 'Wartet noch',
            count: 2,
            action: <button type="button">Neu planen</button>,
            children: <p>Zeilen</p>,
          },
        ]}
      />,
    );
    const body = screen.getByText('Zeilen').parentElement!;
    expect(body.firstElementChild).toBe(screen.getByRole('button', { name: 'Neu planen' }));
  });
});
