import { describe, expect, it } from 'vitest';
import { isFocusPath } from './path';

describe('isFocusPath', () => {
  it('matches module focus routes only', () => {
    expect(isFocusPath('/todos/focus/abc')).toBe(true);
    expect(isFocusPath('/notes/focus/1')).toBe(true);
    expect(isFocusPath('/todos')).toBe(false);
    expect(isFocusPath('/')).toBe(false);
    expect(isFocusPath('/focus/x')).toBe(false);
    expect(isFocusPath('/todos/focused/x')).toBe(false);
  });
});
