// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DateChips } from './DateChips';
import { ItemList, ItemRow } from './Patterns';

const items = (a = vi.fn(), b = vi.fn()) => [
  { id: 'a', label: 'Morgen', onSelect: a, group: 'Später' },
  { id: 'b', label: 'Löschen', onSelect: b, danger: true },
];

describe('ItemRow menu', () => {
  it('opens from the "⋯" button, picks an entry with a click and closes', async () => {
    const user = userEvent.setup();
    const a = vi.fn();
    render(
      <ItemList>
        <ItemRow title="Zahnarzt" onOpen={() => undefined} menu={items(a)} />
      </ItemList>,
    );
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    expect(screen.getByRole('menu')).toBeVisible();
    await user.click(screen.getByRole('menuitem', { name: 'Morgen' }));
    expect(a).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on right-click / long press (contextmenu) and focuses the first entry', () => {
    render(
      <ItemList>
        <ItemRow title="Zahnarzt" onOpen={() => undefined} menu={items()} />
      </ItemList>,
    );
    fireEvent.contextMenu(screen.getByRole('listitem'));
    expect(screen.getByRole('menu')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Morgen' })).toHaveFocus();
  });

  it('moves with the arrow keys and closes with Escape, returning focus to the button', async () => {
    const user = userEvent.setup();
    render(
      <ItemList>
        <ItemRow title="Zahnarzt" onOpen={() => undefined} menu={items()} />
      </ItemList>,
    );
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Morgen' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Weitere Aktionen' })).toHaveFocus();
  });

  it('a row without a menu keeps the browser context menu and shows no "⋯"', () => {
    render(
      <ItemList>
        <ItemRow title="A" onOpen={() => undefined} />
      </ItemList>,
    );
    expect(screen.queryByRole('button', { name: 'Weitere Aktionen' })).toBeNull();
    expect(fireEvent.contextMenu(screen.getByRole('listitem'))).toBe(true);
  });
});

describe('DateChips', () => {
  it('offers today, tomorrow and next week from the given day and marks the current value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateChips value="2026-09-30" from="2026-09-29" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Morgen' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Nächste Woche' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-05');
  });
});
