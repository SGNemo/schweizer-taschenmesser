import { useEffect, type RefObject } from 'react';

/**
 * Marks a row that scrolls sideways with `data-overflow="true|false"`, so its style sheet draws the edge fade ("more to
 * the right") only while the row really overflows; on a row that fits the fade would dim the last entry for nothing.
 * Watches the row and its direct children (chips that load later widen a child, not the row). `key` names what else
 * decides the width (the labels: a language switch changes them without resizing anything observed).
 */
export function useOverflowMark(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => {
      el.dataset.overflow = el.scrollWidth > el.clientWidth + 1 ? 'true' : 'false';
    };
    mark();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mark);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [ref, key]);
}
