// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readShortcutPrefs, writeShortcutPrefs } from './prefs';

beforeEach(() => localStorage.clear());

describe('shortcut preferences (tm-shortcuts)', () => {
  it('start empty: every action uses its default', () => {
    expect(readShortcutPrefs()).toEqual({ keys: {} });
  });

  it('persist per device and hold only the overrides', () => {
    writeShortcutPrefs({ keys: { today: 'F9', 'tool:calc': '' } });
    expect(JSON.parse(localStorage.getItem('tm-shortcuts')!)).toEqual({
      keys: { today: 'F9', 'tool:calc': '' },
    });
    expect(readShortcutPrefs().keys.today).toBe('F9');
  });

  it('survive broken or hostile storage content', () => {
    localStorage.setItem('tm-shortcuts', '{nope');
    expect(readShortcutPrefs()).toEqual({ keys: {} });
    localStorage.setItem('tm-shortcuts', JSON.stringify({ keys: { today: 'F5', x: 'F2' } }));
    expect(readShortcutPrefs()).toEqual({ keys: {} });
  });
});
