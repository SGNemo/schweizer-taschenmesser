import { useEffect, type RefObject } from 'react';

/**
 * Marks a row that scrolls sideways with `data-overflow="true|false"`, so its style sheet draws the edge fade ("more to
 * the right") only while the row really overflows; on a row that fits the fade would dim the last entry for nothing.
 * Watches the row, its direct children (a child that grows widens the row's content, not the row) and children added
 * later (the calendar's chips mount after a live query). `key` names what else decides the width (the labels: a
 * language switch changes them without resizing anything observed).
 */
export function useOverflowMark(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => {
      el.dataset.overflow = el.scrollWidth > el.clientWidth + 1 ? 'true' : 'false';
    };
    mark();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mark);
    ro?.observe(el);
    for (const child of el.children) ro?.observe(child);
    const mo =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            for (const r of records) {
              for (const n of r.addedNodes) if (n instanceof Element) ro?.observe(n);
              for (const n of r.removedNodes) if (n instanceof Element) ro?.unobserve(n);
            }
            mark();
          });
    mo?.observe(el, { childList: true });
    return () => {
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [ref, key]);
}
