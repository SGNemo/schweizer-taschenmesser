// @vitest-environment jsdom
/**
 * Package 5: the drag gesture of the planner's rows. Mouse: a press that moves a few pixels drags; touch: a long press
 * lifts the row, moving it drags, releasing without moving opens the row's menu. A drop on a day calls `onDrop` once;
 * outside a day, on the row's own day or after Escape nothing happens. `M` on the row is the keyboard move.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, useDragMove, type DragRow } from '../components/dragMove';

const onDrop = vi.fn();
const onMoveKey = vi.fn();
const onMenu = vi.fn();
const row: DragRow = {
  unitId: 'todos:a#0',
  title: 'Saugen',
  minutes: 30,
  from: '2026-11-16',
  onDrop,
  onMoveKey,
};

function Harness() {
  const host = useDragMove((id) => (id === row.unitId ? row : undefined));
  return (
    <div ref={host}>
      <ul>
        <li onContextMenu={onMenu}>
          <button type="button" data-row>
            <span data-drag-unit={row.unitId}>Saugen</span>
          </button>
          <button type="button">⋯</button>
        </li>
      </ul>
      <div data-drop-date="2026-11-18" data-testid="wed">
        Mi
      </div>
      <div data-drop-date="2026-11-16" data-testid="mon">
        Mo
      </div>
      <div data-testid="outside">nichts</div>
    </div>
  );
}

/** jsdom has no layout: the element „under“ the pointer is set by the test. */
let under: Element | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  under = null;
  document.elementFromPoint = () => under;
  onDrop.mockReset();
  onMoveKey.mockReset();
  onMenu.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const pointer = (type: string, target: Element | Window, x: number, kind = 'mouse') =>
  fireEvent(
    target,
    Object.assign(
      new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 0 }),
      {
        pointerId: 1,
        pointerType: kind,
        isPrimary: true,
      },
    ),
  );

describe('dragging a row onto a day', () => {
  it('mouse: press, move, release over a day → that thing onto that day, once', () => {
    render(<Harness />);
    const title = screen.getByText('Saugen');
    pointer('pointerdown', title, 0);
    pointer('pointermove', window, 20);
    under = screen.getByTestId('wed');
    pointer('pointermove', window, 40);
    pointer('pointerup', window, 40);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith('2026-11-18');
  });

  it('a plain click is no drag; outside a day, its own day and Escape change nothing', () => {
    render(<Harness />);
    const title = screen.getByText('Saugen');
    // A click (no movement).
    pointer('pointerdown', title, 0);
    pointer('pointerup', window, 2);
    // Outside a day.
    pointer('pointerdown', title, 0);
    under = screen.getByTestId('outside');
    pointer('pointermove', window, 30);
    pointer('pointerup', window, 30);
    // The row's own day.
    pointer('pointerdown', title, 0);
    under = screen.getByTestId('mon');
    pointer('pointermove', window, 30);
    pointer('pointerup', window, 30);
    // Escape while over a day.
    pointer('pointerdown', title, 0);
    under = screen.getByTestId('wed');
    pointer('pointermove', window, 30);
    fireEvent.keyDown(window, { key: 'Escape' });
    pointer('pointerup', window, 30);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('the row’s own controls (⋯) never start a drag', () => {
    render(<Harness />);
    pointer('pointerdown', screen.getByText('⋯'), 0);
    under = screen.getByTestId('wed');
    pointer('pointermove', window, 40);
    pointer('pointerup', window, 40);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('touch: moving before the long press is a scroll; after it the row drags', () => {
    render(<Harness />);
    const title = screen.getByText('Saugen');
    pointer('pointerdown', title, 0, 'touch');
    pointer('pointermove', window, 30, 'touch');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    under = screen.getByTestId('wed');
    pointer('pointerup', window, 30, 'touch');
    expect(onDrop).not.toHaveBeenCalled();

    pointer('pointerdown', title, 0, 'touch');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    pointer('pointermove', window, 30, 'touch');
    pointer('pointerup', window, 30, 'touch');
    expect(onDrop).toHaveBeenCalledWith('2026-11-18');
  });

  it('touch: a long press without moving is still the row’s menu', () => {
    render(<Harness />);
    pointer('pointerdown', screen.getByText('Saugen'), 0, 'touch');
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 10));
    pointer('pointerup', window, 0, 'touch');
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('M on the focused row is the move by keyboard', () => {
    render(<Harness />);
    const main = screen.getByText('Saugen').closest('button')!;
    main.focus();
    fireEvent.keyDown(main, { key: 'm' });
    expect(onMoveKey).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(main, { key: 'm', ctrlKey: true });
    expect(onMoveKey).toHaveBeenCalledTimes(1);
  });
});
