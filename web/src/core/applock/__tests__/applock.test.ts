// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { ALL_VALUE_KEYS } from '@/core/settings/values';
import { setNow } from '@/core/time/now';
import { disableBiometric, enableBiometric, unlockWithBiometric } from '../biometric';
import { FAILS_KEY, MAX_WAIT_MS, recordFail, resetFails, waitFor, waitRemaining } from '../fails';
import { BIO_SEAL, BIO_SECRET, PIN_SECRET } from '../names';
import { checkPin, hasPin, isValidPin, setPin } from '../pin';
import {
  APP_LOCK_KEY,
  DEFAULT_PREFS,
  parsePrefs,
  readPrefs,
  reloadPrefs,
  writePrefs,
} from '../prefs';
import { BACKGROUND_GRACE_MS, startAppLock } from '../start';
import { unlockApp, useAppLock } from '../state';
import { FAST_KDF, fakeBiometrics, memorySecrets } from './helpers';

let secrets: ReturnType<typeof memorySecrets>;
let bio: ReturnType<typeof fakeBiometrics>;
let clock = 1_000_000;

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  unlockApp();
  clock = 1_000_000;
  setNow(() => clock);
  secrets = memorySecrets();
  bio = fakeBiometrics();
  setPlatform({ ...createWebPlatform(), secrets, biometrics: bio.service });
});
afterEach(() => {
  setPlatform(undefined);
  setNow();
  vi.useRealTimers();
});

describe('PIN', () => {
  it('accepts 4 to 12 digits only', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456789012')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567890123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('stores a verifier, never the PIN, and checks right and wrong PINs', async () => {
    await setPin('2468', FAST_KDF);
    expect(await hasPin()).toBe(true);
    const stored = secrets.map.get(PIN_SECRET)!;
    expect(stored).not.toContain('2468');
    expect(await checkPin('2468')).toBe('ok');
    expect(await checkPin('1357')).toBe('wrong');
    expect(await checkPin('abc')).toBe('wrong');
  });

  it('a missing verifier never unlocks', async () => {
    expect(await checkPin('2468')).toBe('wrong');
  });
});

describe('wrong-PIN wait', () => {
  it('starts after 5 wrong tries at 30 s, doubles, stops at 15 min', () => {
    expect([1, 4].map(waitFor)).toEqual([0, 0]);
    expect(waitFor(5)).toBe(30_000);
    expect(waitFor(6)).toBe(60_000);
    expect(waitFor(7)).toBe(120_000);
    expect(waitFor(30)).toBe(MAX_WAIT_MS);
  });

  it('holds across a reload, ends with time, and a correct PIN resets it', async () => {
    await setPin('2468', FAST_KDF);
    for (let i = 0; i < 4; i++) expect(await checkPin('0000')).toBe('wrong');
    expect(await checkPin('0000')).toBe('wait');
    expect(waitRemaining()).toBe(30_000);
    // Stored in localStorage: a reload reads it again.
    expect(JSON.parse(localStorage.getItem(FAILS_KEY)!)).toMatchObject({ count: 5 });
    expect(await checkPin('2468')).toBe('wait'); // even the right PIN waits
    clock += 30_000;
    expect(await checkPin('0000')).toBe('wait'); // 6th wrong: 60 s
    expect(waitRemaining()).toBe(60_000);
    clock += 60_000;
    expect(await checkPin('2468')).toBe('ok');
    expect(localStorage.getItem(FAILS_KEY)).toBeNull();
  });

  it('a broken counter starts fresh', () => {
    localStorage.setItem(FAILS_KEY, '{oops');
    expect(waitRemaining()).toBe(0);
    recordFail();
    expect(JSON.parse(localStorage.getItem(FAILS_KEY)!)).toMatchObject({ count: 1 });
    resetFails();
  });
});

describe('prefs', () => {
  it('never set = off with the defaults', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({
      enabled: false,
      idleMinutes: '5',
      background: 'now',
      biometric: false,
    });
  });

  it('a broken value falls back to the safe side, key by key', () => {
    expect(parsePrefs('not json')).toEqual({
      enabled: true,
      idleMinutes: '5',
      background: 'now',
      biometric: false,
    });
    expect(
      parsePrefs(
        JSON.stringify({ enabled: false, idleMinutes: '7', background: 'x', biometric: 1 }),
      ),
    ).toEqual({ enabled: false, idleMinutes: '5', background: 'now', biometric: false });
    expect(parsePrefs(JSON.stringify({ idleMinutes: '15' })).enabled).toBe(true);
  });

  it('reads and writes localStorage tm-app-lock', () => {
    writePrefs({ enabled: true, idleMinutes: '30' });
    expect(JSON.parse(localStorage.getItem(APP_LOCK_KEY)!)).toMatchObject({
      enabled: true,
      idleMinutes: '30',
    });
    reloadPrefs();
    expect(readPrefs().idleMinutes).toBe('30');
  });

  it('is never part of profiles, history or export (values allow-list)', () => {
    const keys: readonly string[] = ALL_VALUE_KEYS;
    for (const k of ['enabled', 'idleMinutes', 'background', 'biometric', 'appLock', APP_LOCK_KEY])
      expect(keys).not.toContain(k);
    expect(keys.some((k) => /lock|pin|bio/i.test(k))).toBe(false);
  });
});

describe('startAppLock', () => {
  function start(hasPinValue = true) {
    let bg: (() => void) | undefined;
    const stop = startAppLock({
      onBackground: (cb) => {
        bg = cb;
        return () => {
          bg = undefined;
        };
      },
      hasPin: async () => hasPinValue,
    });
    return { stop, background: () => bg?.() };
  }

  it('locks after the idle time; input restarts it', () => {
    vi.useFakeTimers();
    writePrefs({ enabled: true, idleMinutes: '1' });
    const { stop } = start();
    vi.advanceTimersByTime(50_000);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(50_000);
    expect(useAppLock.getState().locked).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(useAppLock.getState().locked).toBe(true);
    stop();
  });

  it('does nothing while the lock is off', () => {
    vi.useFakeTimers();
    const { stop, background } = start();
    background();
    vi.advanceTimersByTime(60 * 60_000);
    expect(useAppLock.getState().locked).toBe(false);
    stop();
  });

  it('background: now locks at once', () => {
    writePrefs({ enabled: true, background: 'now' });
    const { stop, background } = start();
    background();
    expect(useAppLock.getState().locked).toBe(true);
    stop();
  });

  it('background: 30 s locks after the grace, coming back cancels it', () => {
    vi.useFakeTimers();
    writePrefs({ enabled: true, background: '30s', idleMinutes: '30' });
    const { stop, background } = start();
    background();
    vi.advanceTimersByTime(BACKGROUND_GRACE_MS - 1000);
    document.dispatchEvent(new Event('visibilitychange')); // jsdom: visible
    vi.advanceTimersByTime(5000);
    expect(useAppLock.getState().locked).toBe(false);
    background();
    vi.advanceTimersByTime(BACKGROUND_GRACE_MS);
    expect(useAppLock.getState().locked).toBe(true);
    stop();
  });

  it('background: never keeps it open', () => {
    vi.useFakeTimers();
    writePrefs({ enabled: true, background: 'never', idleMinutes: '30' });
    const { stop, background } = start();
    background();
    vi.advanceTimersByTime(BACKGROUND_GRACE_MS * 2);
    expect(useAppLock.getState().locked).toBe(false);
    stop();
  });

  it('a lock that is on without a PIN verifier is turned off', async () => {
    localStorage.setItem(APP_LOCK_KEY, 'broken');
    reloadPrefs();
    useAppLock.setState({ locked: true });
    const { stop } = start(false);
    await vi.waitFor(() => expect(useAppLock.getState().locked).toBe(false));
    expect(readPrefs().enabled).toBe(false);
    stop();
  });

  it('broken prefs with a verifier stay locked', async () => {
    localStorage.setItem(APP_LOCK_KEY, 'broken');
    reloadPrefs();
    useAppLock.setState({ locked: true });
    const { stop } = start(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(useAppLock.getState().locked).toBe(true);
    expect(readPrefs().enabled).toBe(true);
    stop();
  });
});

describe('biometrics', () => {
  it('needs the current PIN, then unlocks with the seal', async () => {
    await setPin('2468', FAST_KDF);
    writePrefs({ enabled: true });
    expect(await enableBiometric('1111')).toBe('wrong');
    expect(readPrefs().biometric).toBe(false);
    expect(await enableBiometric('2468')).toBe('enabled');
    expect(readPrefs().biometric).toBe(true);
    expect(bio.state.sealed.has(BIO_SEAL)).toBe(true);
    expect(secrets.map.get(BIO_SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(await unlockWithBiometric()).toBe('ok');
    bio.state.answer = 'cancelled';
    expect(await unlockWithBiometric()).toBe('cancelled');
    expect(readPrefs().biometric).toBe(true);
  });

  it('invalidated biometrics remove the seal and turn the switch off', async () => {
    await setPin('2468', FAST_KDF);
    writePrefs({ enabled: true });
    await enableBiometric('2468');
    bio.state.answer = 'invalidated';
    expect(await unlockWithBiometric()).toBe('invalid');
    expect(readPrefs().biometric).toBe(false);
    expect(bio.state.sealed.has(BIO_SEAL)).toBe(false);
    expect(secrets.map.has(BIO_SECRET)).toBe(false);
  });

  it('a seal that does not match the stored hash never unlocks', async () => {
    await setPin('2468', FAST_KDF);
    await enableBiometric('2468');
    secrets.map.set(BIO_SECRET, '0'.repeat(64));
    expect(await unlockWithBiometric()).toBe('invalid');
    expect(readPrefs().biometric).toBe(false);
    await disableBiometric();
  });
});
