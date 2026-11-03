import { describe, expect, it } from 'vitest';
import { FIXED_SHORTCUTS, fixedConflict, normalizeCombo } from './fixed';
import { ASSIGNABLE_FKEYS } from './map';

describe('fixed shortcuts', () => {
  it('writes every spelling of a combination the same way', () => {
    expect(normalizeCombo('Ctrl+K')).toBe('mod+k');
    expect(normalizeCombo('CommandOrControl+k')).toBe('mod+k');
    expect(normalizeCombo('shift+control+K')).toBe('mod+shift+k');
    expect(normalizeCombo('Alt+Ctrl+Space')).toBe('mod+alt+space');
    expect(normalizeCombo('Super+Home')).toBe('super+home');
  });

  it('finds the fixed shortcut a global hotkey would take over, and nothing else', () => {
    expect(fixedConflict('CommandOrControl+K')?.id).toBe('palette');
    expect(fixedConflict('Alt+L')?.id).toBe('readAid');
    expect(fixedConflict('Ctrl+Shift+K')).toBeUndefined();
    expect(fixedConflict('Ctrl+Shift+Space')).toBeUndefined(); // the default quick-capture hotkey
  });

  it('never overlaps with the assignable F-keys, so the two lists cannot collide', () => {
    for (const f of FIXED_SHORTCUTS) {
      expect(ASSIGNABLE_FKEYS as readonly string[]).not.toContain(f.keys);
    }
  });
});
