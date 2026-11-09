import { describe, expect, it } from 'vitest';
import { orderKeyboardCoordinates } from './keyboardMove';

const rect = (left: number, top: number, width = 100, height = 100) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

function move(code: string, overId: string | null) {
  const items = ['a', 'b', 'c'];
  // On screen "c" sits above "b" (a later card filled a hole); the order still decides.
  const rects = new Map([
    ['a', rect(0, 0)],
    ['b', rect(0, 300)],
    ['c', rect(0, 150)],
  ]);
  const event = { code, preventDefault: () => {} } as unknown as KeyboardEvent;
  const context = {
    active: { id: 'b', data: { current: { sortable: { items } } } },
    over: overId ? { id: overId } : null,
    collisionRect: rect(0, 300),
    droppableRects: rects,
  };
  return orderKeyboardCoordinates(event, {
    context,
    active: 'b',
    currentCoordinates: { x: 0, y: 300 },
  } as unknown as Parameters<typeof orderKeyboardCoordinates>[1]);
}

describe('keyboard moves on the overview follow the saved order', () => {
  it('up goes to the card before in the order, not the one above on screen', () => {
    expect(move('ArrowUp', null)).toEqual({ x: 0, y: 0 });
  });

  it('down goes to the card after in the order, also from the current drop target', () => {
    expect(move('ArrowDown', null)).toEqual({ x: 0, y: 150 });
    expect(move('ArrowDown', 'c')).toBeUndefined();
  });

  it('ignores other keys', () => {
    expect(move('Space', null)).toBeUndefined();
  });
});
