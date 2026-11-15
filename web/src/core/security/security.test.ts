// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import {
  DEFAULT_SECURITY_PREFS,
  getSecurityPrefs,
  resetSecurityPrefsCache,
  setSecurityPrefs,
  STORAGE_KEY,
  subscribeSecurityPrefs,
} from './prefs';
import { holdScreenGuard, resetScreenGuard, startScreenGuard } from './screen';
import { ALL_VALUE_KEYS } from '@/core/settings/values';

function fakeScreen() {
  const calls: boolean[] = [];
  const base = getPlatform();
  setPlatform({ ...base, screen: { setSecure: async (on: boolean) => void calls.push(on) } });
  return calls;
}

beforeEach(() => {
  localStorage.clear();
  resetSecurityPrefsCache();
  resetScreenGuard();
});
afterEach(() => setPlatform(undefined));

describe('security prefs', () => {
  it('defaults to the guarded vault and plain export allowed', () => {
    expect(getSecurityPrefs()).toEqual(DEFAULT_SECURITY_PREFS);
  });

  it('falls back to the safe default per key for a broken value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ screenGuard: 'nowhere', encryptedOnly: true }),
    );
    expect(getSecurityPrefs()).toEqual({ screenGuard: 'vault', encryptedOnly: true });
    localStorage.setItem(STORAGE_KEY, '{not json');
    resetSecurityPrefsCache();
    expect(getSecurityPrefs()).toEqual(DEFAULT_SECURITY_PREFS);
  });

  it('stores a change on this device and notifies', () => {
    const seen = vi.fn();
    const stop = subscribeSecurityPrefs(seen);
    setSecurityPrefs({ encryptedOnly: true });
    expect(seen).toHaveBeenCalledTimes(1);
    resetSecurityPrefsCache();
    expect(getSecurityPrefs().encryptedOnly).toBe(true);
    stop();
  });

  it('can never be switched by a profile, the history or a settings file', () => {
    for (const key of Object.keys(DEFAULT_SECURITY_PREFS))
      expect(ALL_VALUE_KEYS as readonly string[]).not.toContain(key);
  });
});

describe('screen guard', () => {
  it('is on while the vault holds it and off after', () => {
    const calls = fakeScreen();
    const release = holdScreenGuard();
    release();
    release(); // a second call changes nothing
    expect(calls).toEqual([true, false]);
  });

  it('"everywhere" keeps it on when the vault is left', () => {
    const calls = fakeScreen();
    const stop = startScreenGuard();
    setSecurityPrefs({ screenGuard: 'everywhere' });
    const release = holdScreenGuard();
    release();
    expect(calls).toEqual([false, true]);
    setSecurityPrefs({ screenGuard: 'vault' });
    expect(calls).toEqual([false, true, false]);
    stop();
  });
});
