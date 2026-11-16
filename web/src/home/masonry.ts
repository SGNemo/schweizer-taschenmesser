import { useLayoutEffect, useRef, useState } from 'react';
import misc from '@/ui/Misc.module.css';

/** Longest time a step of cards waits for its slowest card before they show anyway (a card that never loads must not hide the rest). */
export const SETTLE_CAP_MS = 1500;

/** Grids that have shown their first cards: `aria-busy` is only set until then. */
const settled = new WeakSet<HTMLElement>();
/** Cards a grid has taken in: a card is held back once, when it first mounts, never again on a re-pack. */
const seen = new WeakSet<HTMLElement>();

/** Columns of a grid as laid out right now (its `grid-template-columns` tracks); at least one. */
export function gridColumns(grid: HTMLElement): number {
  const tracks = getComputedStyle(grid).gridTemplateColumns.trim();
  // Not laid out (no tracks resolved, e.g. inside a hidden ancestor): one column, so the first step stays small.
  if (!tracks || tracks === 'none' || tracks.includes('(')) return 1;
  return tracks.split(/\s+/).length;
}

/**
 * The cards the overview mounts: while it builds up, the first step (`first` cards, the column count; nothing while
 * that is unknown) when a second step holds more than one more row; else all of them.
 */
export function stagedCards<T>(shown: readonly T[], first: number, built: boolean): readonly T[] {
  return !built && shown.length > 2 * first ? shown.slice(0, first) : shown;
}

/** True while one of the cards still shows a loading skeleton (its code or its data is not there yet). */
export function stillLoading(cards: readonly HTMLElement[], skeleton: string): boolean {
  return cards.some((el) => el.querySelector(skeleton) !== null);
}

/**
 * The overview grid's build-up and its empty-card mark. The grid itself is plain CSS (rows of equal height,
 * `Home.module.css`; the masonry packing of U19 gave way to flush rows in round "Tiefe"). A card whose body is only the
 * compact empty state (it carries `data-empty`, never found by a style class) is marked `data-empty` too. Measurements only write attributes (no React state).
 * `enabled = false` (the overview's edit mode) shows every card at once and holds nothing back.
 * Build-up (decision "Overview builds up in grid order"): a card that mounts waits hidden (`data-wait`,
 * `visibility: hidden` in `Home.module.css`) until every waiting card has its content, or `SETTLE_CAP_MS` after the
 * step could start; then they show together and `onShown` runs (the overview then mounts its next step). Grid
 * placement puts a card by the cards before it only, so cards that show later never move one already shown. Until
 * that, the grid is `data-settling` (the "Mehr anzeigen" row below it waits too) and, the first time, `aria-busy`.
 */
export function useGridBuildUp<T extends HTMLElement>(
  keys: string,
  enabled = true,
  ready = true,
  onShown?: () => void,
  // false once the page has built up: a card that mounts later (another view, a new card) shows at once, as before.
  holdNew = true,
) {
  // A callback ref: a grid element that mounts again (same keys) is taken in again.
  const [grid, setGrid] = useState<T | null>(null);
  const shownRef = useRef(onShown);
  useLayoutEffect(() => {
    shownRef.current = onShown;
  });
  useLayoutEffect(() => {
    if (!grid) return;
    if (!enabled || typeof ResizeObserver === 'undefined') {
      // Edit mode shows every card at once: they count as taken in, so leaving it holds none of them back. An engine
      // without a ResizeObserver (old WebViews, jsdom) holds nothing either: the page counts as shown.
      for (const el of Array.from(grid.children)) seen.add(el as HTMLElement);
      if (enabled) shownRef.current?.();
      return;
    }
    const mark = (el: HTMLElement) => {
      const empty = el.querySelector('[data-empty]') !== null;
      if (empty !== el.hasAttribute('data-empty')) el.toggleAttribute('data-empty', empty);
    };
    const children = () => Array.from(grid.children) as HTMLElement[];
    for (const el of children()) {
      mark(el);
      if (!seen.has(el)) {
        seen.add(el);
        if (holdNew) el.setAttribute('data-wait', '');
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
    // A body that swaps its skeleton for its content may end the wait: content changes re-mark and re-check, once
    // per frame.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const el of children()) mark(el);
        check();
      });
    });
    mutations.observe(grid, { childList: true, subtree: true });
    return () => {
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
    };
  }, [enabled, grid, keys, ready, holdNew]);
  return setGrid;
}
