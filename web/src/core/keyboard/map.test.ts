import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_FKEYS,
  assignKey,
  DEFAULT_FKEYS,
  DEFAULT_SHORTCUT_PREFS,
  FKEY_ACTIONS,
  holderOf,
  keyToAction,
  resetKey,
  resolveKeys,
  sanitizePrefs,
  TOOL_CHORDS,
  type ShortcutPrefs,
} from './map';

describe('defaults', () => {
  it('give every key to at most one action, all of them assignable', () => {
    const keys = Object.values(DEFAULT_FKEYS).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(ASSIGNABLE_FKEYS).toContain(k);
    expect(Object.keys(DEFAULT_FKEYS).sort()).toEqual([...FKEY_ACTIONS].sort());
  });

  it('give F10 to the cockpit; the settings page starts without a key', () => {
    expect(DEFAULT_FKEYS.cockpit).toBe('F10');
    expect(DEFAULT_FKEYS.settings).toBe('');
    expect(keyToAction(DEFAULT_SHORTCUT_PREFS).F10).toBe('cockpit');
  });

  it('never use F1, F4 (voice), F5, F11 or F12', () => {
    for (const k of ['F1', 'F4', 'F5', 'F11', 'F12']) expect(ASSIGNABLE_FKEYS).not.toContain(k);
  });

  it('give every tool chord a unique letter', () => {
    const ids = Object.values(TOOL_CHORDS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOOL_CHORDS.t).toBe('timer');
  });
});

describe('assignKey', () => {
  const empty = DEFAULT_SHORTCUT_PREFS;

  it('stores only what differs from the default', () => {
    expect(assignKey(empty, 'today', 'F9')).toEqual({
      ok: false,
      reason: 'taken',
      by: 'tool:calc',
    });
    const freed: ShortcutPrefs = { keys: { 'tool:calc': '' } };
    const moved = assignKey(freed, 'today', 'F9');
    expect(moved.ok && moved.prefs.keys).toEqual({ today: 'F9', 'tool:calc': '' });
    const back = assignKey({ keys: { today: 'F9', 'tool:calc': '' } }, 'today', 'F6');
    expect(back.ok && back.prefs.keys).toEqual({ 'tool:calc': '' });
  });

  it('refuses a taken key with the holder, never moving it silently', () => {
    expect(assignKey(empty, 'focus', 'F2')).toEqual({ ok: false, reason: 'taken', by: 'quickAdd' });
  });

  it('refuses the voice key', () => {
    expect(assignKey(empty, 'tool:screenshot', 'F8', 'F8')).toEqual({
      ok: false,
      reason: 'taken',
      by: 'voice',
    });
  });

  it.each(['F1', 'F4', 'F5', 'F11', 'F12', 'Alt+F4', 'Ctrl+F2', 'Shift+F6', 'KeyA', 'Space'])(
    'rejects %s (browser, system or typing)',
    (key) => {
      expect(assignKey(empty, 'today', key)).toEqual({ ok: false, reason: 'rejected' });
    },
  );

  it('allows no key at all and giving the same key again', () => {
    expect(assignKey(empty, 'today', '').ok).toBe(true);
    expect(assignKey(empty, 'today', 'F6').ok).toBe(true);
  });

  it('resetKey is refused while another action holds the standard key', () => {
    const moved: ShortcutPrefs = { keys: { quickAdd: '', today: 'F2' } };
    expect(resetKey(moved, 'quickAdd')).toEqual({ ok: false, reason: 'taken', by: 'today' });
  });
});

describe('resolveKeys', () => {
  it('uses overrides over defaults and lets the voice key win a clash', () => {
    const prefs: ShortcutPrefs = { keys: { today: 'F9' } };
    expect(resolveKeys(prefs).today).toBe('F9');
    expect(resolveKeys(prefs).quickAdd).toBe('F2');
    expect(resolveKeys(DEFAULT_SHORTCUT_PREFS, 'F8')['tool:timer']).toBe('');
    expect(keyToAction(DEFAULT_SHORTCUT_PREFS, 'F8').F8).toBeUndefined();
  });

  it('gives a key to only one action even if stored data clashes (first in table order wins)', () => {
    const resolved = resolveKeys({ keys: { settings: 'F2' } });
    expect(resolved.quickAdd).toBe('F2');
    expect(resolved.settings).toBe('');
    expect(holderOf({ keys: { settings: 'F2' } }, 'F2')).toBe('quickAdd');
    // With the voice key given, the action that key suppresses is not a holder (re-recording it
    // for voice must not be refused with "F8 gehört schon zu Timer"), other defaults still are.
    expect(holderOf({ keys: {} }, 'F8', 'F8')).toBeUndefined();
    expect(holderOf({ keys: {} }, 'F9', 'F8')).toBe('tool:calc');
  });
});

describe('sanitizePrefs', () => {
  it('drops unknown actions and unusable keys', () => {
    expect(
      sanitizePrefs({
        keys: { today: 'F9', bogus: 'F2', focus: 'F5', settings: 'Alt+F4', 'tool:calc': '' },
      }),
    ).toEqual({ keys: { today: 'F9', 'tool:calc': '' } });
    expect(sanitizePrefs('x')).toEqual({ keys: {} });
    expect(sanitizePrefs(null)).toEqual({ keys: {} });
  });
});
