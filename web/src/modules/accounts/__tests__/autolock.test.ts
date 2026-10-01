// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KeychainHeader } from '@/core/crypto';
import { startAutoLock, type AutoLockDeps } from '../autolock';
import { setSession } from '../session';
import type { AccountsSettings } from '../settings';

const header = {} as KeychainHeader;
const unlock = () => setSession({ status: 'unlocked', vaultId: 'v', header, dek: {} as CryptoKey });
const lock = () => setSession({ status: 'locked' });

let background: (() => void) | undefined;
let deps: AutoLockDeps & { lock: Mock<() => void> };
let stop: (() => void) | undefined;

function setup(settings: AccountsSettings) {
  background = undefined;
  deps = {
    settings: async () => settings,
    onBackground: (cb) => {
      background = cb;
      return () => (background = undefined);
    },
    lock: vi.fn<() => void>(),
  };
  stop = startAutoLock(deps);
}

beforeEach(() => {
  vi.useFakeTimers();
  lock();
});
afterEach(() => {
  stop?.();
  lock();
  vi.useRealTimers();
});

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('auto-lock', () => {
  it('locks after the configured inactivity, and activity restarts the timer', async () => {
    setup({ autoLockMinutes: '1', backgroundLock: 'now' });
    unlock();
    await settle();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(deps.lock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(deps.lock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(deps.lock).toHaveBeenCalledTimes(1);
  });

  it('honours other durations', async () => {
    setup({ autoLockMinutes: '15', backgroundLock: 'now' });
    unlock();
    await settle();
    await vi.advanceTimersByTimeAsync(14 * 60_000);
    expect(deps.lock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(deps.lock).toHaveBeenCalledTimes(1);
  });

  it('locks at once when the app goes to the background (setting "now")', async () => {
    setup({ autoLockMinutes: '30', backgroundLock: 'now' });
    unlock();
    await settle();
    background!();
    expect(deps.lock).toHaveBeenCalledTimes(1);
  });

  it('waits 30 s in the background (setting "30s") and is cancelled by coming back', async () => {
    setup({ autoLockMinutes: '30', backgroundLock: '30s' });
    unlock();
    await settle();
    background!();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(deps.lock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(deps.lock).toHaveBeenCalledTimes(1);

    deps.lock.mockClear();
    background!();
    await vi.advanceTimersByTimeAsync(10_000);
    document.dispatchEvent(new Event('visibilitychange')); // jsdom: visible again
    await vi.advanceTimersByTimeAsync(60_000);
    expect(deps.lock).not.toHaveBeenCalled();
  });

  it('does nothing while locked and disarms when the vault locks', async () => {
    setup({ autoLockMinutes: '1', backgroundLock: 'now' });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(deps.lock).not.toHaveBeenCalled();
    unlock();
    await settle();
    expect(background).toBeDefined();
    lock();
    expect(background).toBeUndefined();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(deps.lock).not.toHaveBeenCalled();
  });
});
