/**
 * Global keyboard shortcuts (DESIGN-SPEC § 8). Single letters never fire while typing, with a
 * modifier held, or while a dialog is open; `Ctrl+Z` leaves text fields to the browser.
 *
 *  N                quick capture            G then H/P/G/A/W/T   go to Heute/Planen/Geld/Haushalt/Wissen/Tresor
 *  J/K or ↓/↑       next / previous row      E                    edit the focused row (`data-row-edit`, else open it)
 *  Space            tick the focused row (`data-row-tick`)         /   focus the list search (`data-list-search`)
 *  ?                shortcut sheet           Ctrl+Z               undo the last action
 */
import { now } from '@/core/time/now';
import { isTypingTarget } from './typing';

/** How long after `G` the second key may follow. */
export const CHORD_MS = 1200;

/** Second key of the `G` chord → destination. `h` is the home screen; areas are filled in by the shell. */
export const CHORD_LETTERS = {
  h: 'home',
  p: 'plan',
  g: 'money',
  a: 'household',
  w: 'knowledge',
  t: 'vault',
} as const;

export interface ShortcutContext {
  /** Path for a chord letter, or undefined when that area is not available. */
  destination(letter: keyof typeof CHORD_LETTERS): string | undefined;
  go(to: string): void;
  quickAdd(): void;
  showShortcuts(): void;
  undo(): void;
}

type Key = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target' | 'defaultPrevented'
> &
  Partial<Pick<KeyboardEvent, 'preventDefault' | 'stopPropagation'>>;

/** Rows on the page that can be seen (not inside a `hidden` or `display: none` container). */
const rows = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('main [data-row]')].filter(
    (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none',
  );

function moveRow(delta: 1 | -1): void {
  const list = rows();
  if (list.length === 0) return;
  const current = list.findIndex(
    (el) => el === document.activeElement || el.contains(document.activeElement),
  );
  const next =
    current < 0
      ? delta > 0
        ? 0
        : list.length - 1
      : Math.min(list.length - 1, Math.max(0, current + delta));
  const el = list[next]!;
  el.focus();
  el.scrollIntoView?.({ block: 'nearest' });
}

const focusedRowItem = (): HTMLElement | null =>
  (document.activeElement as HTMLElement | null)?.closest('[data-row]')?.closest('li') ?? null;

/** Builds the `keydown` handler (pure of React, so it can be tested directly). */
export function createShortcutHandler(ctx: ShortcutContext): (e: Key) => void {
  let chordAt: number | null = null;
  return (e) => {
    if (e.defaultPrevented) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const typing = isTypingTarget(e.target);

    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'z') {
      if (typing) return; // text undo belongs to the field
      e.preventDefault?.();
      ctx.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
    if (document.querySelector('dialog[open]')) return;

    if (chordAt !== null) {
      const fresh = now() - chordAt <= CHORD_MS;
      chordAt = null;
      if (fresh && key in CHORD_LETTERS) {
        const to = ctx.destination(key as keyof typeof CHORD_LETTERS);
        if (to) {
          e.preventDefault?.();
          e.stopPropagation?.(); // module shortcuts (accounts: P, T) must not see the second key
          ctx.go(to);
        }
        return;
      }
    }

    switch (key) {
      case 'g':
        chordAt = now();
        return;
      case 'n':
        e.preventDefault?.();
        ctx.quickAdd();
        return;
      case '?':
        e.preventDefault?.();
        ctx.showShortcuts();
        return;
      case 'j':
        moveRow(1);
        return;
      case 'k':
        moveRow(-1);
        return;
      case 'ArrowDown':
      case 'ArrowUp': {
        // Arrows only drive the list once a row has focus; elsewhere they scroll as usual.
        if (!(document.activeElement as HTMLElement | null)?.closest('[data-row]')) return;
        e.preventDefault?.();
        moveRow(key === 'ArrowDown' ? 1 : -1);
        return;
      }
      case 'e': {
        // The row's own edit hook, else its main button (which opens the editor).
        const item = focusedRowItem();
        (
          item?.querySelector<HTMLElement>('[data-row-edit]') ??
          item?.querySelector<HTMLElement>('button[data-row]')
        )?.click();
        return;
      }
      case ' ': {
        const tick = focusedRowItem()?.querySelector<HTMLElement>('[data-row-tick]');
        if (!tick) return;
        e.preventDefault?.();
        tick.click();
        return;
      }
      case '/': {
        const search = document.querySelector<HTMLElement>('[data-list-search]');
        if (!search) return;
        e.preventDefault?.();
        search.focus();
        return;
      }
    }
  };
}
