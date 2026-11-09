import { useLayoutEffect, useState } from 'react';
import misc from '@/ui/Misc.module.css';

/**
 * Rows a card of `height` px takes in the packed grid: the grid's rows are 1 px and have no gap, the gap
 * below a card is its margin, so the card's area is its own height plus one gap, rounded up.
 */
export function packedRows(height: number, gap: number): number {
  return Math.max(1, Math.ceil(height + gap));
}

/**
 * U19/U39 (UI round 6): packs the overview grid without holes. A card that grew taller than its size class
 * used to stretch the shared row tracks, and every shorter card beside it left a hole below. Here each card
 * spans exactly the 1 px rows its own height needs (`--rows`, read by `.packed` in `Home.module.css` from two
 * columns on), `grid-auto-flow: row dense` then moves the next card up into the free space. A card whose body is
 * only the compact empty state is marked `data-empty` and drops its size class's minimum height (one line of
 * text needs no 300 px). Size classes, order and widths stay as they are; on one column nothing changes.
 * Measurements only write CSS variables and attributes (no React state), so a card that loads later only
 * re-packs; its own height never depends on its span (`align-items: start`), so there is no resize loop.
 * `enabled = false` (the overview's edit mode) leaves the grid unpacked: there the cards sit in the saved order on
 * the size-class rows, so dragging and the keyboard (dnd-kit picks targets by position) move a card where it looks.
 */
export function usePackedGrid<T extends HTMLElement>(keys: string, enabled = true) {
  // A callback ref: a grid element that mounts again (same keys) is packed again.
  const [grid, setGrid] = useState<T | null>(null);
  useLayoutEffect(() => {
    if (!enabled || !grid || typeof ResizeObserver === 'undefined') return;
    const measure = (el: HTMLElement) => {
      const empty = el.querySelector(`.${misc.emptyCompact}`) !== null;
      if (empty !== el.hasAttribute('data-empty')) el.toggleAttribute('data-empty', empty);
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const rows = String(packedRows(el.offsetHeight, gap));
      if (el.style.getPropertyValue('--rows') !== rows) el.style.setProperty('--rows', rows);
    };
    const observer = new ResizeObserver((list) => {
      for (const e of list) measure(e.target as HTMLElement);
    });
    const children = () => Array.from(grid.children) as HTMLElement[];
    for (const el of children()) {
      measure(el);
      observer.observe(el);
    }
    // A body that swaps its skeleton for the empty state may keep the card's height (the size class's minimum),
    // so content changes re-check too, once per frame.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const el of children()) measure(el);
      });
    });
    mutations.observe(grid, { childList: true, subtree: true });
    grid.setAttribute('data-packed', 'true');
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      grid.removeAttribute('data-packed');
    };
  }, [enabled, grid, keys]);
  return setGrid;
}
