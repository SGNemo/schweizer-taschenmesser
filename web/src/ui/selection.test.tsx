// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { ItemList, ItemRow } from './Patterns';
import { SelectionBar } from './SelectionBar';
import { useSelection } from './useSelection';
import { SWIPE_PX } from './useSwipeRow';

describe('useSelection', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('toggles single rows and takes a range with Shift', () => {
    const { result } = renderHook(() => useSelection(order));
    act(() => result.current.toggle('b'));
    expect(result.current.ids).toEqual(['b']);
    act(() => result.current.toggle('d', true));
    expect(result.current.ids).toEqual(['b', 'c', 'd']);
    act(() => result.current.toggle('c'));
    expect(result.current.ids).toEqual(['b', 'd']);
  });

  it('Escape clears the selection, but not while typing', () => {
    const { result } = renderHook(() => useSelection(order));
    act(() => result.current.toggle('a'));
    const input = document.createElement('input');
    document.body.append(input);
    act(() => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(result.current.count).toBe(1);
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    });
    expect(result.current.count).toBe(0);
  });

  it('select all and clear', () => {
    const { result } = renderHook(() => useSelection(order));
    act(() => result.current.selectAll());
    expect(result.current.count).toBe(5);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });
});

describe('SelectionBar', () => {
  it('shows the count and the actions, Abbrechen last; nothing when empty', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <SelectionBar count={2} onCancel={onCancel}>
        <Button>Erledigt</Button>
      </SelectionBar>,
    );
    expect(screen.getByText('2 ausgewählt')).toBeVisible();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Erledigt', 'Abbrechen']);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(<SelectionBar count={0} onCancel={onCancel} />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('swipe on a row', () => {
  function setup() {
    const right = vi.fn();
    const left = vi.fn();
    render(
      <ItemList>
        <ItemRow
          title="Zeile"
          onSwipeRight={right}
          swipeRightLabel="Erledigt"
          onSwipeLeft={left}
          swipeLeftLabel="Später"
        />
      </ItemList>,
    );
    const row = screen.getByText('Zeile').closest('div[class*="row"]')!;
    (row as HTMLElement).setPointerCapture = () => undefined;
    return { row: row as HTMLElement, right, left };
  }

  const drag = (row: HTMLElement, from: number, to: number, pointerType = 'touch') => {
    fireEvent.pointerDown(row, { pointerId: 1, pointerType, clientX: from, clientY: 0 });
    fireEvent.pointerMove(row, { pointerId: 1, pointerType, clientX: to, clientY: 0 });
    fireEvent.pointerUp(row, { pointerId: 1, pointerType, clientX: to, clientY: 0 });
  };

  it('a long swipe right/left triggers the matching action', () => {
    const { row, right, left } = setup();
    drag(row, 0, SWIPE_PX + 10);
    expect(right).toHaveBeenCalledOnce();
    drag(row, 200, 200 - SWIPE_PX - 10);
    expect(left).toHaveBeenCalledOnce();
  });

  it('a short swipe or a mouse drag does nothing', () => {
    const { row, right, left } = setup();
    drag(row, 0, SWIPE_PX - 20);
    drag(row, 0, SWIPE_PX + 30, 'mouse');
    expect(right).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
  });

  it('a mostly vertical drag is left to scrolling', () => {
    const { row, right } = setup();
    fireEvent.pointerDown(row, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
    fireEvent.pointerMove(row, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80 });
    fireEvent.pointerUp(row, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 80 });
    expect(right).not.toHaveBeenCalled();
  });
});
