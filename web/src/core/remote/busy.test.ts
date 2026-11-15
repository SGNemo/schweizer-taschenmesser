import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteHostService } from '@/core/platform/types';

const reported: number[] = [];
let supported = true;
let fail = false;

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    remoteHost: {
      get supported() {
        return supported;
      },
      reportBusy: (bits: number) => {
        reported.push(bits);
        return fail ? Promise.reject(new Error('not-started')) : Promise.resolve();
      },
    } as Partial<RemoteHostService>,
  }),
}));

import { BUSY_BACKUP, BUSY_EVERY_MS, BUSY_SYNC, startRemoteBusyReport } from './busy';

afterEach(() => {
  reported.length = 0;
  supported = true;
  fail = false;
  vi.useRealTimers();
});

describe('remote busy report', () => {
  it('tells the shell on change only', () => {
    vi.useFakeTimers();
    let bits = 0;
    const stop = startRemoteBusyReport(() => bits);
    expect(reported).toEqual([0]);
    vi.advanceTimersByTime(BUSY_EVERY_MS * 3);
    expect(reported).toEqual([0]);
    bits = BUSY_SYNC | BUSY_BACKUP;
    vi.advanceTimersByTime(BUSY_EVERY_MS);
    expect(reported).toEqual([0, 3]);
    stop();
    bits = 0;
    vi.advanceTimersByTime(BUSY_EVERY_MS * 3);
    expect(reported).toEqual([0, 3]);
  });

  it('tells again after the shell did not take it', async () => {
    vi.useFakeTimers();
    fail = true;
    const stop = startRemoteBusyReport(() => BUSY_SYNC);
    await vi.advanceTimersByTimeAsync(0);
    fail = false;
    await vi.advanceTimersByTimeAsync(BUSY_EVERY_MS);
    expect(reported).toEqual([BUSY_SYNC, BUSY_SYNC]);
    stop();
  });

  it('does nothing where this PC cannot be controlled', () => {
    supported = false;
    startRemoteBusyReport(() => BUSY_SYNC)();
    expect(reported).toEqual([]);
  });
});
