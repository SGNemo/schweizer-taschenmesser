import type { CaptureType } from '../parser';

/** How many type chips the capture form shows before „Mehr (n)“ (decision #856). */
export const SHOWN_TYPES = 6;

/**
 * The type chips in view: the order of `available`, never re-sorted. Folded, the first five stay
 * fixed and the sixth slot holds the selected type when it would be folded, else the sixth in
 * order – so the selected type (guessed, default, inbox or picked) is never only behind „Mehr“.
 * `hidden` is what „Mehr (n)“ counts; it is 0 when everything fits or the fold is open.
 */
export function visibleTypes(
  available: readonly CaptureType[],
  selected: CaptureType | undefined,
  open: boolean,
): { shown: CaptureType[]; hidden: number } {
  if (open || available.length <= SHOWN_TYPES) return { shown: [...available], hidden: 0 };
  const fixed = available.slice(0, SHOWN_TYPES - 1);
  const sixth =
    selected && available.includes(selected) && !fixed.includes(selected)
      ? selected
      : available[SHOWN_TYPES - 1]!;
  return { shown: [...fixed, sixth], hidden: available.length - SHOWN_TYPES };
}
