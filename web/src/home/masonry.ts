import { useLayoutEffect, useRef, useState } from 'react';
import misc from '@/ui/Misc.module.css';

/**
 * Rows a card of `height` px takes in the packed grid: the grid's rows are 1 px and have no gap, the gap
 * below a card is its margin, so the card's area is its own height plus one gap, rounded up.
 */
export function packedRows(height: number, gap: number): number {
  return Math.max(1, Math.ceil(height + gap));
}

/** Longest time a step of cards waits for its slowest card before they show anyway (a card that never loads must not hide the rest). */
export const SETTLE_CAP_MS = 1500;

/** Grids that have shown their first cards: `aria-busy` is only set until then. */
const settled = new WeakSet<HTMLElement>();
/** Cards a grid has taken in: a card is held back once, when it first mounts, never again on a re-pack. */
const seen = new WeakSet<HTMLElement>();

/** Columns of a grid as laid out right now (its `grid-template-columns` tracks); at least one. */
export function gridColumns(grid: HTMLElement): number {
  const tracks = getComputedStyle(grid).gridTemplateColumns.trim();
  return tracks && tracks !== 'none' ? tracks.split(/\s+/).length : 1;
}

/** True while one of the cards still shows a loading skeleton (its code or its data is not there yet). */
export function stillLoading(cards: readonly HTMLElement[], skeleton: string): boolean {
  return cards.some((el) => el.querySelector(skeleton) !== null);
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
 * Build-up (decision "Overview builds up in grid order"): a card that mounts waits hidden (`data-wait`,
 * `visibility: hidden` in `Home.module.css`) until every waiting card has its content, or `SETTLE_CAP_MS` after the
 * step could start; then they show together and `onShown` runs (the overview then mounts its next step). Grid
 * placement puts a card by the cards before it only, so cards that show later never move one already shown. Until
 * that, the grid is `data-settling` (the "Mehr anzeigen" row below it waits too) and, the first time, `aria-busy`.
 */
export function usePackedGrid<T extends HTMLElement>(
  keys: string,
  enabled = true,
  ready = true,
  onShown?: () => void,
) {
  // A callback ref: a grid element that mounts again (same keys) is packed again.
  const [grid, setGrid] = useState<T | null>(null);
  const shownRef = useRef(onShown);
  useLayoutEffect(() => {
    shownRef.current = onShown;
  });
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
      if (!seen.has(el)) {
        seen.add(el);
        el.setAttribute('data-wait', '');
      }
    }
    const waiting = () => children().filter((el) => el.hasAttribute('data-wait'));
    let cap = 0;
    const release = () => {
      window.clearTimeout(cap);
      cap = 0;
      for (const el of waiting()) el.removeAttribute('data-wait');
      grid.removeAttribute('data-settling');
      grid.removeAttribute('aria-busy');
      settled.add(grid);
      shownRef.current?.();
    };
    const check = () => {
      if (!ready || !grid.hasAttribute('data-settling')) return;
      const held = waiting();
      // Nothing to wait for (a calm view without the "Heute" card): the row below the grid may show.
      if (held.length === 0 || !stillLoading(held, `.${misc.skeleton}`)) release();
      // The step can start: its cap runs from now (from the mount of its cards, not from the page load).
      else if (!cap) cap = window.setTimeout(release, SETTLE_CAP_MS);
    };
    if (!settled.has(grid) || waiting().length > 0) {
      grid.setAttribute('data-settling', 'true');
      if (!settled.has(grid)) grid.setAttribute('aria-busy', 'true');
      check();
    }
    // A body that swaps its skeleton for its content changes the card's height and may end the wait: content
    // changes re-measure and re-check, once per frame.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const el of children()) measure(el);
        check();
      });
    });
    mutations.observe(grid, { childList: true, subtree: true });
    grid.setAttribute('data-packed', 'true');
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(cap);
      // A card still waiting is taken in again by the next run (same commit, nothing is painted between); with the
      // grid disabled (edit mode) it shows.
      for (const el of waiting()) {
        el.removeAttribute('data-wait');
        seen.delete(el);
      }
      grid.removeAttribute('data-settling');
      grid.removeAttribute('aria-busy');
      grid.removeAttribute('data-packed');
    };
  }, [enabled, grid, keys, ready]);
  return setGrid;
}
