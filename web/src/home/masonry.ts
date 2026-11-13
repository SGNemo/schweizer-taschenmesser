import { useLayoutEffect, useState } from 'react';
import misc from '@/ui/Misc.module.css';

/**
 * Rows a card of `height` px takes in the packed grid: the grid's rows are 1 px and have no gap, the gap
 * below a card is its margin, so the card's area is its own height plus one gap, rounded up.
 */
export function packedRows(height: number, gap: number): number {
  return Math.max(1, Math.ceil(height + gap));
}

/** Longest time the cards wait for each other before they show (a card that never loads must not hide the rest). */
export const SETTLE_CAP_MS = 1500;

/** Grids that have shown their cards once: a re-pack (another view, a new card) never hides them again. */
const settled = new WeakSet<HTMLElement>();

/**
 * True while a card of the first screen still shows a loading skeleton. Cards are as high as their content
 * (identity 4.0, no minimum height per size class), so each one that loads would push the ones below it.
 */
export function firstScreenLoading(
  cards: readonly HTMLElement[],
  fold: number,
  skeleton: string,
): boolean {
  return cards.some(
    (el) => el.getBoundingClientRect().top < fold && el.querySelector(skeleton) !== null,
  );
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
 * plain rows, so dragging and the keyboard (dnd-kit picks targets by position) move a card where it looks.
 * First load: the grid carries `data-settling` (its cards are laid out but not painted, `Home.module.css`) until the
 * cards of the first screen have their content or `SETTLE_CAP_MS` have passed, so they appear once, at their own
 * heights, instead of growing one after the other.
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
    let cap = 0;
    const settle = () => {
      window.clearTimeout(cap);
      settled.add(grid);
      grid.removeAttribute('data-settling');
    };
    const settleWhenLoaded = () => {
      if (!grid.hasAttribute('data-settling') || children().length === 0) return;
      if (!firstScreenLoading(children(), window.innerHeight, `.${misc.skeleton}`)) settle();
    };
    if (!settled.has(grid)) {
      grid.setAttribute('data-settling', 'true');
      if (children().length > 0) cap = window.setTimeout(settle, SETTLE_CAP_MS);
      settleWhenLoaded();
    }
    // A body that swaps its skeleton for the empty state may keep the card's height (the size class's minimum),
    // so content changes re-check too, once per frame.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const el of children()) measure(el);
        settleWhenLoaded();
      });
    });
    mutations.observe(grid, { childList: true, subtree: true });
    grid.setAttribute('data-packed', 'true');
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(cap);
      grid.removeAttribute('data-settling');
      grid.removeAttribute('data-packed');
    };
  }, [enabled, grid, keys]);
  return setGrid;
}
