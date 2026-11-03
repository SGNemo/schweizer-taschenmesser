// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { advancedOpen, readAdvancedOpen, writeAdvancedOpen } from './foldState';
import { warningFor } from './warnings';

beforeEach(() => localStorage.clear());

describe('Erweitert fold state', () => {
  it('uses the global default until the category makes its own choice, which then wins', () => {
    expect(advancedOpen('ki', false)).toBe(false);
    expect(advancedOpen('ki', true)).toBe(true);
    writeAdvancedOpen('ki', true);
    expect(advancedOpen('ki', false)).toBe(true);
    writeAdvancedOpen('ki', false);
    expect(advancedOpen('ki', true)).toBe(false);
    expect(readAdvancedOpen('sync')).toBeUndefined();
  });

  it('keeps categories apart and survives broken storage content', () => {
    writeAdvancedOpen('ki', true);
    writeAdvancedOpen('ueber', false);
    expect(readAdvancedOpen('ki')).toBe(true);
    localStorage.setItem('tm-settings-adv', '{not json');
    expect(readAdvancedOpen('ki')).toBeUndefined();
    localStorage.setItem('tm-settings-adv', JSON.stringify({ ki: 'yes', ueber: true }));
    expect(readAdvancedOpen('ki')).toBeUndefined();
    expect(readAdvancedOpen('ueber')).toBe(true);
  });
});

describe('security notes', () => {
  it('speaks up for the weaker vault choices only', () => {
    expect(warningFor('module-accounts--autoLockMinutes', '30')).toBe('autoLockLong');
    expect(warningFor('module-accounts--autoLockMinutes', '5')).toBeUndefined();
    expect(warningFor('module-accounts--backgroundLock', '30s')).toBe('backgroundDelay');
    expect(warningFor('module-accounts--backgroundLock', 'now')).toBeUndefined();
    expect(warningFor('module-todos--showDone', true)).toBeUndefined();
  });
});
