/** Where a row menu opens: below its button, or above it when the thumb zone has no room. */
export type MenuSide = 'down' | 'up';

/**
 * `triggerTop/Bottom`: the button's rect in the visual viewport. `bottomReserve` is what the
 * bottom bar covers. Opens upwards only when it does not fit below and there is more room above.
 */
export function menuSide(opts: {
  triggerTop: number;
  triggerBottom: number;
  menuHeight: number;
  viewportHeight: number;
  bottomReserve: number;
}): MenuSide {
  const below = opts.viewportHeight - opts.bottomReserve - opts.triggerBottom;
  const above = opts.triggerTop;
  return below < opts.menuHeight && above > below ? 'up' : 'down';
}
