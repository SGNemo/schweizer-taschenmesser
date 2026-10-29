import { getLang } from '@/core/i18n/lang';

/**
 * Key strings of the voice key: `F4`, `Alt+M`, `Ctrl+Shift+Space` (the same form the global
 * hotkeys use). A bare key is only allowed for F1–F12 – anything else would steal typing.
 */
type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
>;

/** German key cap names (the other languages keep the English ones, see docs/i18n/GLOSSARY.md). */
const GERMAN_KEY_NAMES: Record<string, string> = {
  Ctrl: 'Strg',
  Shift: 'Umschalt',
  Space: 'Leertaste',
};

const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph']);
const F_KEY = /^F([1-9]|1[0-2])$/;

/** The key part of an event (`F4`, `M`, `Space`), layout independent; undefined for a bare modifier. */
export function keyOf(e: Pick<KeyEventLike, 'key' | 'code'>): string | undefined {
  if (MODIFIERS.has(e.key)) return undefined;
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.code || undefined;
}

export function keyString(e: KeyEventLike): string | undefined {
  const key = keyOf(e);
  if (!key) return undefined;
  const parts = [
    e.ctrlKey && 'Ctrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super',
  ];
  return [...parts.filter(Boolean), key].join('+');
}

/** Whether a recorded key string may be used (F-key alone, or any key with Ctrl/Alt/Super). */
export function isValidVoiceKey(key: string): boolean {
  const parts = key.split('+');
  const last = parts.pop() ?? '';
  if (!last) return false;
  if (parts.length === 0) return F_KEY.test(last);
  return parts.some((p) => p === 'Ctrl' || p === 'Alt' || p === 'Super');
}

/** Display form: `Ctrl+Alt+M` → `Ctrl + Alt + M`-style key caps are built by the caller. */
export const keyCaps = (key: string): string[] =>
  key
    .split('+')
    .filter(Boolean)
    .map((k) => (getLang() === 'de' ? (GERMAN_KEY_NAMES[k] ?? k) : k));
