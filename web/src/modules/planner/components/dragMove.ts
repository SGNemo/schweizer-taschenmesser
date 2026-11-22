import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Moving by dragging (planner rethink, package 5): a row is dragged onto a day of the week band or the four-week
 * grid – with the mouse once it moved a few pixels, on touch after a long press. Dropping outside a day, or Escape,
 * changes nothing. The same move is in the row's menu („Verschieben …“, first entry) and on `M` (WCAG 2.5.7: dragging
 * always has a one-pointer and a keyboard way).
 *
 * The page listens once (event delegation): a row offers itself with `data-drag-unit` on an element inside its `li`,
 * a day takes a drop with `data-drop-date` on its tile. Nothing here writes; `onDrop` is the page's move action.
 */

export interface DragRow {
  unitId: string;
  title: string;
  minutes: number;
  /** The day the row lies on: dropping it there again does nothing. */
  from?: string;
  onDrop: (date: string) => void;
  /** `M` on the focused row: the move by keyboard („Verschieben …“). */
  onMoveKey?: () => void;
  /** False where no day is in sight to drop on (the tab „Noch offen“): `M` only, no drag. */
  drag?: boolean;
}

export interface DragState {
  unitId: string;
  title: string;
  minutes: number;
  from?: string;
  /** Lifted by a long press, not moved yet (touch). */
  lifted: boolean;
  x: number;
  y: number;
  /** The day under the pointer. */
  over?: string;
}

let state: DragState | null = null;
const subscribers = new Set<() => void>();
function publish(next: DragState | null) {
  state = next;
  for (const notify of subscribers) notify();
}
const subscribe = (notify: () => void) => {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
};

/** The drag in progress (or null): the ghost and the drop targets read it. */
export const useDragState = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );

/** Touch: how long the finger rests before the row lifts. */
export const LONG_PRESS_MS = 450;
/** Touch: moving farther before the row lifted is a scroll or a swipe, no drag. */
const TOUCH_SLOP = 8;
/** Mouse: the press becomes a drag after this many pixels (a plain click opens the thing as before). */
const MOUSE_START = 6;

/** The band of the window's top and bottom edge that scrolls the page while dragging, and the pixels per frame. */
const EDGE = 48;
const EDGE_SPEED = 12;

/** The element that scrolls the page around `el` (the app's main area, else the document). */
function scrollerOf(el: HTMLElement): Element {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (/(auto|scroll)/.test(overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** The day under a point: the nearest element with `data-drop-date`. */
export function dropDateAt(x: number, y: number): string | undefined {
  const el = document.elementFromPoint?.(x, y);
  return el?.closest<HTMLElement>('[data-drop-date]')?.dataset.dropDate;
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Drag and `M` for every row inside the element the returned ref is set on (rows carry `data-drag-unit`). A callback
 * ref: the page's column may be mounted anew (the split view switches), the listeners follow it.
 */
export function useDragMove(rowOf: (unitId: string) => DragRow | undefined) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  // The page re-renders often; the listeners read the latest lookup.
  const lookup = useRef(rowOf);
  useEffect(() => {
    lookup.current = rowOf;
  });

  useEffect(() => {
    if (!host) return;

    type Gesture = {
      row: DragRow;
      li: HTMLElement;
      pointerId: number;
      mouse: boolean;
      x0: number;
      y0: number;
      timer?: ReturnType<typeof setTimeout>;
      lifted: boolean;
      dragging: boolean;
      /** Where the pointer is (the target is read again while the page scrolls under it). */
      x: number;
      y: number;
      /** Near the top or bottom edge: the page scrolls by itself (-1 up, 1 down, 0 not). */
      edge: -1 | 0 | 1;
      frame?: number;
    };
    let g: Gesture | null = null;

    const show = (x: number, y: number) =>
      g &&
      publish({
        unitId: g.row.unitId,
        title: g.row.title,
        minutes: g.row.minutes,
        ...(g.row.from ? { from: g.row.from } : {}),
        lifted: !g.dragging,
        x,
        y,
        ...(g.dragging ? { over: dropDateAt(x, y) } : {}),
      });

    const end = () => {
      if (!g) return;
      clearTimeout(g.timer);
      if (g.frame) cancelAnimationFrame(g.frame);
      g.li.removeAttribute('data-drag-source');
      document.documentElement.removeAttribute('data-dragging');
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('keydown', onEscape, true);
      document.removeEventListener('touchmove', onTouchMove, true);
      g = null;
      publish(null);
    };

    const lift = () => {
      if (!g) return;
      g.lifted = true;
      g.li.setAttribute('data-drag-source', '');
      show(g.x0, g.y0);
    };

    const onDown = (e: PointerEvent) => {
      if (g || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const target = e.target instanceof Element ? e.target : null;
      const li = target?.closest<HTMLElement>('li');
      const unit = li?.querySelector<HTMLElement>('[data-drag-unit]')?.dataset.dragUnit;
      if (!li || !unit || !host.contains(li)) return;
      // The row's own controls (tick, lock, ⋯, a link chip) keep their taps; its main button may start a drag.
      const control = target?.closest('button, a, input, label, [role="checkbox"]');
      if (control && !control.matches('[data-row]')) return;
      const row = lookup.current(unit);
      if (!row || row.drag === false) return;
      g = {
        row,
        li,
        pointerId: e.pointerId,
        mouse: e.pointerType === 'mouse',
        x0: e.clientX,
        y0: e.clientY,
        lifted: false,
        dragging: false,
        x: e.clientX,
        y: e.clientY,
        edge: 0,
      };
      if (!g.mouse) g.timer = setTimeout(lift, LONG_PRESS_MS);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('keydown', onEscape, true);
      document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    };

    const onMove = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.pointerId) return;
      // The button was released where no `pointerup` reached the page (outside the window): the drag is over.
      if (g.mouse && e.buttons === 0) return end();
      if (!g.dragging) {
        const moved = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
        if (g.mouse) {
          if (moved < MOUSE_START) return;
        } else if (!g.lifted) {
          // Moved before the long press: a scroll or a swipe – no drag.
          if (moved > TOUCH_SLOP) end();
          return;
        } else if (moved < TOUCH_SLOP) return;
        g.dragging = true;
        // A press that became a drag selects no text.
        window.getSelection()?.removeAllRanges();
        g.li.setAttribute('data-drag-source', '');
        document.documentElement.setAttribute('data-dragging', '');
      }
      // The row's swipe and the page's text selection do not see a drag.
      e.preventDefault();
      e.stopPropagation();
      g.x = e.clientX;
      g.y = e.clientY;
      show(e.clientX, e.clientY);
      // A day out of sight (the band above „Noch ohne Tag“): near an edge the page scrolls while the pointer rests.
      g.edge = e.clientY < EDGE ? -1 : e.clientY > window.innerHeight - EDGE ? 1 : 0;
      if (g.edge && !g.frame) g.frame = requestAnimationFrame(scroll);
    };

    const scroll = () => {
      if (!g) return;
      g.frame = undefined;
      if (!g.dragging || !g.edge) return;
      scrollerOf(host).scrollBy(0, g.edge * EDGE_SPEED);
      show(g.x, g.y);
      g.frame = requestAnimationFrame(scroll);
    };

    const swallowClick = () => {
      const stop = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, true), 0);
    };

    const onUp = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.pointerId) return;
      const { row, li, dragging, lifted } = g;
      if (dragging) {
        e.preventDefault();
        e.stopPropagation();
        swallowClick();
        const date = dropDateAt(e.clientX, e.clientY);
        end();
        if (date && date !== row.from) row.onDrop(date);
        return;
      }
      end();
      // A long press without moving stays what it was: the row's menu.
      if (lifted) {
        swallowClick();
        li.querySelector('[data-row]')?.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
          }),
        );
      }
    };
    const onCancel = (e: PointerEvent) => {
      if (g && e.pointerId === g.pointerId) end();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !g) return;
      e.preventDefault();
      e.stopPropagation();
      end();
    };
    // Lifted or dragging on touch: the page does not scroll under the finger.
    const onTouchMove = (e: TouchEvent) => {
      if (g && (g.lifted || g.dragging) && e.cancelable) e.preventDefault();
    };
    // Touch: the browser's long press would open the row's menu while the row lifts – the gesture decides.
    const onContextMenu = (e: Event) => {
      if (g && !g.mouse) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.ctrlKey || e.metaKey || e.altKey || typing(e.target))
        return;
      const li = e.target instanceof Element ? e.target.closest('li') : null;
      const unit = li?.querySelector<HTMLElement>('[data-drag-unit]')?.dataset.dragUnit;
      const move = unit ? lookup.current(unit)?.onMoveKey : undefined;
      if (!move) return;
      e.preventDefault();
      move();
    };

    // The window lost the focus mid-drag (alt-tab): nothing is dropped.
    window.addEventListener('blur', end);
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('contextmenu', onContextMenu, true);
    host.addEventListener('keydown', onKey);
    return () => {
      end();
      window.removeEventListener('blur', end);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('contextmenu', onContextMenu, true);
      host.removeEventListener('keydown', onKey);
    };
  }, [host]);
  return setHost;
}

/** A day as it would be with `minutes` more on it: what a drop target shows while a row is dragged over it. */
export function withDropped<
  D extends { off: boolean; free: number; planned: number; usable: number; over?: number },
>(day: D, minutes: number): D {
  const planned = day.planned + minutes;
  return {
    ...day,
    planned,
    free: Math.max(0, day.free - minutes),
    over: Math.max(0, planned - day.usable),
  };
}

/** The minutes dragged over `date` (null when nothing is, or the row lies there already). */
export const droppedOn = (drag: DragState | null, date: string): number | null =>
  drag && drag.over === date && drag.from !== date ? drag.minutes : null;
