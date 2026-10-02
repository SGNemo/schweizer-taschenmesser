// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { entryAction, isTypingTarget } from '../shortcuts';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('entry shortcuts', () => {
  it('maps u, p, t, o (any case) to actions', () => {
    expect(entryAction(key('u'))).toBe('username');
    expect(entryAction(key('P'))).toBe('password');
    expect(entryAction(key('t'))).toBe('totp');
    expect(entryAction(key('O'))).toBe('open');
    expect(entryAction(key('x'))).toBeUndefined();
  });
  it('ignores combinations with ctrl, meta or alt (browser shortcuts)', () => {
    expect(entryAction(key('p', { ctrlKey: true }))).toBeUndefined();
    expect(entryAction(key('t', { metaKey: true }))).toBeUndefined();
    expect(entryAction(key('o', { altKey: true }))).toBeUndefined();
  });
  it('knows typing targets', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
