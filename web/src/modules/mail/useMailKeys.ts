import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/core/keyboard/typing';

/**
 * Keyboard shortcuts of the mail page, close to Gmail's (module setting „Tastenkürzel“, on by default):
 *
 *  c  new mail              /  search              u  back to the list        x  select the focused row
 *  o  open the focused row  e  archive             #  trash (asks)            !  spam (asks)
 *  s  star / unstar         r  reply               a  reply all               f  forward
 *  Shift+I  mark read       Shift+U  mark unread
 *
 * J/K (next/previous row) and ? (shortcut sheet) stay the app's own. Nothing fires while typing, with
 * Ctrl/Alt/Meta, or while a dialog is open; every key does what its button does, so whatever asks first
 * still asks first.
 */
export type MailKey =
  | 'compose'
  | 'search'
  | 'back'
  | 'select'
  | 'open'
  | 'archive'
  | 'trash'
  | 'spam'
  | 'star'
  | 'reply'
  | 'replyAll'
  | 'forward'
  | 'read'
  | 'unread';

type KeyLike = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'target' | 'defaultPrevented'
> &
  Partial<Pick<KeyboardEvent, 'isComposing' | 'repeat'>>;

const PLAIN: Record<string, MailKey> = {
  c: 'compose',
  '/': 'search',
  u: 'back',
  x: 'select',
  o: 'open',
  e: 'archive',
  '#': 'trash',
  '!': 'spam',
  s: 'star',
  r: 'reply',
  a: 'replyAll',
  f: 'forward',
};

/** Which mail action a key press asks for; `undefined` for anything that is not a mail shortcut here. */
export function mailKeyOf(e: KeyLike): MailKey | undefined {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.repeat)
    return undefined;
  if (isTypingTarget(e.target)) return undefined;
  if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) return undefined;
  if (e.shiftKey && (e.key === 'I' || e.key === 'i')) return 'read';
  if (e.shiftKey && (e.key === 'U' || e.key === 'u')) return 'unread';
  // `#`, `!` and `/` need Shift on many layouts (German: Shift+7 is `/`); letters must come without it.
  if (e.key === '#' || e.key === '!' || e.key === '/') return PLAIN[e.key];
  if (e.shiftKey) return undefined;
  return PLAIN[e.key.toLowerCase()];
}

/**
 * Listens for the given mail keys while `enabled`. The listener sits in the capture phase, so a key the
 * mail page uses is handled once; the app's own E (open the focused row) steps aside while an open mail
 * carries `data-shortcut-scope="mail"` (`core/keyboard/shortcuts.ts`). Keys without a handler pass through.
 */
export function useMailKeys(
  enabled: boolean,
  handlers: Partial<Record<MailKey, () => void>>,
): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const key = mailKeyOf(e);
      const run = key && latest.current[key];
      if (!run) return;
      e.preventDefault();
      e.stopPropagation();
      run();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [enabled]);
}

/** The list row that has keyboard focus (J/K move it), as its thread id. */
export function focusedThreadId(): string | undefined {
  const row = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-row]');
  return row?.querySelector<HTMLElement>('[data-thread-id]')?.dataset.threadId;
}
