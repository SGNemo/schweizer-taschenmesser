/**
 * The shortcuts the app itself owns and that cannot be changed (their handlers sit in the shell):
 * listed read-only in Settings, and the reason a global hotkey may not take them. The assignable
 * F-keys live in `map.ts`.
 */

export type FixedShortcutId = 'palette' | 'tools' | 'readAid' | 'home' | 'undo';

export interface FixedShortcut {
  id: FixedShortcutId;
  /** Key caps in the form of the voice key / global hotkeys (`Ctrl+K`); `Ctrl` stands for Cmd on a Mac. */
  keys: string;
}

export const FIXED_SHORTCUTS: readonly FixedShortcut[] = [
  { id: 'palette', keys: 'Ctrl+K' },
  { id: 'tools', keys: 'Ctrl+.' },
  { id: 'readAid', keys: 'Alt+L' },
  { id: 'home', keys: 'Alt+Home' },
  { id: 'undo', keys: 'Ctrl+Z' },
];

const MODS: Record<string, string> = {
  ctrl: 'mod',
  control: 'mod',
  commandorcontrol: 'mod',
  cmdorctrl: 'mod',
  cmd: 'mod',
  command: 'mod',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  super: 'super',
  meta: 'super',
  win: 'super',
};
const ORDER = ['mod', 'alt', 'shift', 'super'];

/** One form for `Ctrl+K`, `CommandOrControl+k`, `control+K` …: modifiers in a fixed order, the key in lower case. */
export function normalizeCombo(combo: string): string {
  const parts = combo.split('+').filter(Boolean);
  const key = (parts.pop() ?? '').toLowerCase();
  const mods = [...new Set(parts.map((p) => MODS[p.toLowerCase()] ?? p.toLowerCase()))].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  return [...mods, key].join('+');
}

/** The fixed shortcut a combination would take over, if any. */
export function fixedConflict(combo: string): FixedShortcut | undefined {
  const n = normalizeCombo(combo);
  return FIXED_SHORTCUTS.find((f) => normalizeCombo(f.keys) === n);
}
