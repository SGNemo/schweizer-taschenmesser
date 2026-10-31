/**
 * Phone topbar that folds away while reading (mobile header, task 04). The decision is a pure
 * function: scroll position and direction in, "folded or not" out. The topbar comes back the moment
 * the user scrolls up, is at the top, uses the keyboard in the bar, or something else needs it
 * (palette, dialog, on-screen keyboard). With less motion the bar never moves.
 */

/** Scrolled less than this from the top: the bar is always out. */
export const COLLAPSE_AFTER_PX = 48;
/** Movements smaller than this are finger jitter and change nothing. */
export const SCROLL_NOISE_PX = 4;

export interface CollapseInput {
  /** Current state. */
  collapsed: boolean;
  /** Scroll position now and at the last event (px from the top). */
  y: number;
  prevY: number;
  /** Keyboard focus is inside the topbar. */
  focusInside: boolean;
  /** Palette, dialog or sheet is open. */
  overlayOpen: boolean;
  /** On-screen keyboard is up (or an editable field has focus). */
  keyboard: boolean;
  /** Phone layout only; on the desktop the bar stays. */
  phone: boolean;
  /** "Less motion" (operating system or in-app): the bar stays fixed. */
  reducedMotion: boolean;
}

export function nextCollapsed(i: CollapseInput): boolean {
  if (!i.phone || i.reducedMotion || i.focusInside || i.overlayOpen || i.keyboard) return false;
  if (i.y <= COLLAPSE_AFTER_PX) return false;
  const dy = i.y - i.prevY;
  if (Math.abs(dy) < SCROLL_NOISE_PX) return i.collapsed;
  return dy > 0;
}

/** Less motion asked for by the system or in the app (Einstellungen → Darstellung → Bewegung). */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduce') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** An element the on-screen keyboard belongs to. */
export function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement)
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type);
  return (el as HTMLElement).isContentEditable === true;
}
