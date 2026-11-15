import { closestCenter, type Collision, type CollisionDetection } from '@dnd-kit/core';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Distance between the nearest pair of same corners of two boxes (top-left to top-left, …). */
export function cornerGap(a: Box, b: Box): number {
  const corners = (r: Box) => [
    [r.left, r.top],
    [r.left + r.width, r.top],
    [r.left, r.top + r.height],
    [r.left + r.width, r.top + r.height],
  ];
  const ca = corners(a);
  const cb = corners(b);
  return Math.min(...ca.map(([x, y], i) => Math.hypot(x! - cb[i]![0]!, y! - cb[i]![1]!)));
}

/**
 * Collision detection of the overview's edit mode. With a pointer: the closest centre, as before. With the keyboard
 * (no pointer): dnd-kit's sortable keyboard step puts the moved card on a corner of the target card; the target is
 * the card that shares a corner with it. The closest centre picked the card's own place again whenever the cards
 * differ in size (a one-column card moved onto a two-column one), so "move up" did nothing.
 */
export const overviewCollision: CollisionDetection = (args) => {
  if (args.pointerCoordinates) return closestCenter(args);
  const out: Collision[] = [];
  for (const container of args.droppableContainers) {
    const rect = args.droppableRects.get(container.id);
    if (!rect) continue;
    out.push({
      id: container.id,
      data: { droppableContainer: container, value: cornerGap(args.collisionRect, rect) },
    });
  }
  return out.sort((a, b) => (a.data!.value as number) - (b.data!.value as number));
};
