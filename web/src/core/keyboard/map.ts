/**
 * The key map: which key reaches which action. Pure data and rules, no React.
 *
 *  - `T` then a letter opens a tool (fixed letters, below; only tools that exist and are switched on).
 *  - F-keys run top actions. Only F2, F3 and F6–F10 can be assigned: F1, F5, F11, F12 and every
 *    combination (Alt+F4 …) belong to the browser or the system. F4 stays the voice key
 *    (`core/voice/settings` is its source); one key belongs to exactly one action.
 */

/** Tool id by the letter after `T`. Tools that do not exist (yet) or are off are simply skipped. */
export const TOOL_CHORDS = {
  t: 'timer',
  r: 'calc',
  q: 'qr',
  u: 'units',
  d: 'dates',
  s: 'screenshot',
  c: 'currency',
  z: 'timezones',
  w: 'dice',
  x: 'text',
  i: 'image',
  p: 'pdf',
  v: 'dev',
  f: 'diff',
  e: 'regex',
} as const;
export type ToolChordLetter = keyof typeof TOOL_CHORDS;

export const isToolChordLetter = (key: string): key is ToolChordLetter =>
  Object.prototype.hasOwnProperty.call(TOOL_CHORDS, key);

/** The chord letter of a tool, if it has one. */
export const chordLetterOf = (toolId: string): ToolChordLetter | undefined =>
  (Object.keys(TOOL_CHORDS) as ToolChordLetter[]).find((l) => TOOL_CHORDS[l] === toolId);

/** F-keys a person may assign. F4 is the voice key and stays there. */
export const ASSIGNABLE_FKEYS = ['F2', 'F3', 'F6', 'F7', 'F8', 'F9', 'F10'] as const;

export type FKeyAction =
  | 'quickAdd'
  | 'palette'
  | 'today'
  | 'focus'
  | 'settings'
  | 'tool:timer'
  | 'tool:calc'
  | 'tool:screenshot';

/** Order = order in the settings table; the first holder wins if stored data ever clashes. */
export const FKEY_ACTIONS: readonly FKeyAction[] = [
  'quickAdd',
  'palette',
  'today',
  'focus',
  'tool:timer',
  'tool:calc',
  'tool:screenshot',
  'settings',
];

/** Seven keys for eight actions: the screenshot tool starts without a key (it is off by default). */
export const DEFAULT_FKEYS: Readonly<Record<FKeyAction, string>> = {
  quickAdd: 'F2',
  palette: 'F3',
  today: 'F6',
  focus: 'F7',
  'tool:timer': 'F8',
  'tool:calc': 'F9',
  'tool:screenshot': '',
  settings: 'F10',
};

/** The tool id of a `tool:<id>` action. */
export const toolOfAction = (action: FKeyAction): string | undefined =>
  action.startsWith('tool:') ? action.slice(5) : undefined;

/** Overrides only: an action missing here uses its default; `''` = no key. */
export interface ShortcutPrefs {
  keys: Partial<Record<FKeyAction, string>>;
}

export const DEFAULT_SHORTCUT_PREFS: ShortcutPrefs = { keys: {} };

const isAction = (id: string): id is FKeyAction => (FKEY_ACTIONS as readonly string[]).includes(id);
const isAssignable = (key: string): boolean =>
  (ASSIGNABLE_FKEYS as readonly string[]).includes(key);

/** Keeps known actions with an assignable key (or `''`); anything else in storage is ignored. */
export function sanitizePrefs(raw: unknown): ShortcutPrefs {
  const keys: ShortcutPrefs['keys'] = {};
  const src = (raw as { keys?: unknown } | null)?.keys;
  if (src && typeof src === 'object') {
    for (const [action, key] of Object.entries(src)) {
      if (isAction(action) && typeof key === 'string' && (key === '' || isAssignable(key)))
        keys[action] = key;
    }
  }
  return { keys };
}

/** The key each action ends up with: override or default; a clash or the voice key leaves it unassigned. */
export function resolveKeys(prefs: ShortcutPrefs, voiceKey = ''): Record<FKeyAction, string> {
  const out = {} as Record<FKeyAction, string>;
  const used = new Set<string>(voiceKey ? [voiceKey] : []);
  for (const action of FKEY_ACTIONS) {
    const key = prefs.keys[action] ?? DEFAULT_FKEYS[action];
    if (key && !used.has(key)) {
      used.add(key);
      out[action] = key;
    } else out[action] = '';
  }
  return out;
}

/** Key → action, for the keydown handler. */
export function keyToAction(prefs: ShortcutPrefs, voiceKey = ''): Record<string, FKeyAction> {
  const out: Record<string, FKeyAction> = {};
  for (const [action, key] of Object.entries(resolveKeys(prefs, voiceKey)))
    if (key) out[key] = action as FKeyAction;
  return out;
}

export type AssignResult =
  | { ok: true; prefs: ShortcutPrefs }
  | { ok: false; reason: 'rejected' }
  | { ok: false; reason: 'taken'; by: FKeyAction | 'voice' };

/**
 * Gives `action` the key `key` (`''` = none). A key belongs to exactly one action: a taken key is
 * refused, never silently moved. Keys of the browser or system (and every combination) are refused.
 */
export function assignKey(
  prefs: ShortcutPrefs,
  action: FKeyAction,
  key: string,
  voiceKey = '',
): AssignResult {
  if (key !== '') {
    if (!isAssignable(key)) return { ok: false, reason: 'rejected' };
    if (key === voiceKey) return { ok: false, reason: 'taken', by: 'voice' };
    const holder = holderOf(prefs, key, voiceKey);
    if (holder && holder !== action) return { ok: false, reason: 'taken', by: holder };
  }
  const keys = { ...prefs.keys };
  if (key === DEFAULT_FKEYS[action]) delete keys[action];
  else keys[action] = key;
  return { ok: true, prefs: { keys } };
}

/** The action that currently uses `key`, if any. */
export function holderOf(prefs: ShortcutPrefs, key: string, voiceKey = ''): FKeyAction | undefined {
  return keyToAction(prefs, voiceKey)[key];
}

/** The action back on its standard key; refused while another action holds that key. */
export function resetKey(prefs: ShortcutPrefs, action: FKeyAction, voiceKey = ''): AssignResult {
  return assignKey(prefs, action, DEFAULT_FKEYS[action], voiceKey);
}
