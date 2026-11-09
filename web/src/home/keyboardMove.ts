import { KeyboardCode, type KeyboardCoordinateGetter, type UniqueIdentifier } from '@dnd-kit/core';

const STEP: Partial<Record<string, number>> = {
  [KeyboardCode.Up]: -1,
  [KeyboardCode.Left]: -1,
  [KeyboardCode.Down]: 1,
  [KeyboardCode.Right]: 1,
};

/**
 * Keyboard moves on the overview follow the saved order, not the screen: up/left = one place earlier, down/right =
 * one place later. The packed grid (`masonry.ts`) lets a later card fill a hole above an earlier one, so "the card
 * above" on screen is not always the one before in the order, and dnd-kit's geometric getter jumped several places.
 * Returns the position that centres the dragged card on its neighbour in the order (`closestCenter` then picks it).
 */
export const orderKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const step = STEP[event.code];
  if (step === undefined) return undefined;
  event.preventDefault();
  const { active, over, collisionRect, droppableRects } = context;
  if (!active || !collisionRect) return undefined;
  const items = (active.data.current as { sortable?: { items?: UniqueIdentifier[] } } | undefined)
    ?.sortable?.items;
  if (!items) return undefined;
  const target = items[items.indexOf(over?.id ?? active.id) + step];
  const rect = target === undefined ? undefined : droppableRects.get(target);
  if (!rect) return undefined;
  return {
    x: rect.left + (rect.width - collisionRect.width) / 2,
    y: rect.top + (rect.height - collisionRect.height) / 2,
  };
};
