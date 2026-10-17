import { describe, expect, it } from 'vitest';
import { isValidVoiceKey, keyCaps, keyOf, keyString } from './keys';

const ev = (
  key: string,
  code: string,
  mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {},
) => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('voice key strings', () => {
  it('builds F4, Alt+M and Ctrl+Shift+Space from events (layout independent)', () => {
    expect(keyString(ev('F4', 'F4'))).toBe('F4');
    expect(keyString(ev('µ', 'KeyM', { altKey: true }))).toBe('Alt+M');
    expect(keyString(ev(' ', 'Space', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+Space');
  });

  it('a bare modifier is no key', () => {
    expect(keyOf(ev('Control', 'ControlLeft'))).toBeUndefined();
    expect(keyString(ev('Alt', 'AltLeft', { altKey: true }))).toBeUndefined();
  });

  it('accepts F1–F12 alone and other keys only with Ctrl/Alt/Super', () => {
    for (const ok of ['F1', 'F4', 'F12', 'Alt+M', 'Ctrl+Space', 'Super+K'])
      expect(isValidVoiceKey(ok), ok).toBe(true);
    for (const bad of ['', 'M', 'Space', 'F13', 'Shift+M', 'Enter'])
      expect(isValidVoiceKey(bad), bad).toBe(false);
  });

  it('splits into key caps', () => {
    expect(keyCaps('Alt+M')).toEqual(['Alt', 'M']);
  });
});
