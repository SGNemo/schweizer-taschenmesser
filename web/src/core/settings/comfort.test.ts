import { describe, expect, it } from 'vitest';
import {
  comfortSettingsSchema,
  DEFAULT_COMFORT,
  resolveAdvanced,
  withModuleAdvanced,
} from './comfort';

describe('resolveAdvanced', () => {
  it('is Basis by default', () => {
    expect(resolveAdvanced(DEFAULT_COMFORT, 'todos')).toBe(false);
  });
  it('follows the global switch when the module has no choice of its own', () => {
    expect(resolveAdvanced({ ...DEFAULT_COMFORT, advancedAll: true }, 'todos')).toBe(true);
  });
  it("a module's own choice overrides the global switch in both directions", () => {
    const all = { advancedAll: true, advancedModules: { todos: 'basic' as const } };
    expect(resolveAdvanced(all, 'todos')).toBe(false);
    expect(resolveAdvanced(all, 'calendar')).toBe(true);
    const none = { advancedAll: false, advancedModules: { calendar: 'advanced' as const } };
    expect(resolveAdvanced(none, 'calendar')).toBe(true);
    expect(resolveAdvanced(none, 'todos')).toBe(false);
  });
});

describe('withModuleAdvanced', () => {
  it('stores the choice for one module and keeps the others', () => {
    const s = { advancedAll: false, advancedModules: { todos: 'advanced' as const } };
    expect(withModuleAdvanced(s, 'calendar', true).advancedModules).toEqual({
      todos: 'advanced',
      calendar: 'advanced',
    });
    expect(withModuleAdvanced(s, 'todos', false).advancedModules).toEqual({ todos: 'basic' });
  });
  it('the stored shape passes the schema; defaults too', () => {
    expect(comfortSettingsSchema.safeParse(DEFAULT_COMFORT).success).toBe(true);
    expect(
      comfortSettingsSchema.safeParse({ advancedAll: false, advancedModules: { x: 'weird' } })
        .success,
    ).toBe(false);
  });
});
