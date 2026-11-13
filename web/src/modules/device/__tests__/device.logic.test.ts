import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_CONFIG, INTERVAL_MS } from '@/core/backup/auto';
import type { DriveInfo } from '@/core/platform/disk';
import { hubState, mainDrive, nextBackup } from '../logic';

const AT = 1_800_000_000_000;
const on = { ...DEFAULT_AUTO_CONFIG, enabled: true };

describe('next automatic backup', () => {
  it('is "by hand" where the platform has no automatic backup, whatever is stored', () => {
    expect(nextBackup(false, on, { at: AT, ok: true }, true, AT)).toEqual({ state: 'manual' });
  });
  it('is off while the switch is off', () => {
    expect(nextBackup(true, DEFAULT_AUTO_CONFIG, { at: AT, ok: true }, true, AT)).toEqual({
      state: 'off',
    });
  });
  it('is one interval after the last good run', () => {
    expect(nextBackup(true, on, { at: AT, ok: true }, true, AT + 1000)).toEqual({
      state: 'planned',
      at: AT + INTERVAL_MS.daily,
    });
    expect(
      nextBackup(true, { ...on, interval: 'weekly' }, { at: AT, ok: true }, true, AT + 1000),
    ).toEqual({ state: 'planned', at: AT + INTERVAL_MS.weekly });
  });
  it('is due without a run, after a failed run and once the interval is over (same rule as the runner)', () => {
    expect(nextBackup(true, on, undefined, true, AT)).toEqual({ state: 'due' });
    expect(
      nextBackup(true, on, { at: AT, ok: false, error: 'write-failed' }, true, AT + 1),
    ).toEqual({
      state: 'due',
    });
    expect(nextBackup(true, on, { at: AT, ok: true }, true, AT + INTERVAL_MS.daily)).toEqual({
      state: 'due',
    });
  });
});

const drive = (over: Partial<DriveInfo>): DriveInfo => ({
  root: 'D:\\',
  label: '',
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: 1000,
  freeBytes: 400,
  bus: 'nvme',
  model: null,
  isSystem: false,
  health: { status: 'unknown' } as DriveInfo['health'],
  ...over,
});

describe('automatic backup without its passphrase', () => {
  it('says so instead of promising a run the runner skips (never "due" or a date)', () => {
    expect(nextBackup(true, on, { at: AT, ok: true }, false, AT + 1000)).toEqual({
      state: 'no-passphrase',
    });
    expect(nextBackup(true, on, undefined, false, AT)).toEqual({ state: 'no-passphrase' });
    // Switched off or in the browser, the passphrase does not matter.
    expect(nextBackup(true, DEFAULT_AUTO_CONFIG, undefined, false, AT)).toEqual({ state: 'off' });
    expect(nextBackup(false, on, undefined, false, AT)).toEqual({ state: 'manual' });
  });
});

describe('the drive the page speaks about', () => {
  it('is the system drive, else none (the line says "system drive")', () => {
    const system = drive({ root: 'C:\\', isSystem: true });
    expect(mainDrive([drive({}), system])).toBe(system);
    expect(mainDrive([drive({})])).toBeUndefined();
    expect(mainDrive([drive({ isSystem: true, totalBytes: 0 })])).toBeUndefined();
    expect(mainDrive([])).toBeUndefined();
  });
});

describe('home-network hub', () => {
  it('is one of three words', () => {
    expect(hubState({ state: 'listening' })).toBe('listening');
    expect(hubState({ state: 'failed' })).toBe('failed');
    expect(hubState({ state: 'off' })).toBe('off');
  });
  it('held off by the network is not "off": a public network and another network than at pairing keep their reason', () => {
    expect(hubState({ state: 'off', reason: 'public-network' })).toBe('public-network');
    expect(hubState({ state: 'off', reason: 'no-home' })).toBe('no-home');
    for (const reason of ['nothing-wanted', 'unreadable', 'no-network', null, undefined] as const)
      expect(hubState({ state: 'off', reason }), String(reason)).toBe('off');
    // A hub that listens or failed says so, whatever reason is left over.
    expect(hubState({ state: 'listening', reason: 'public-network' })).toBe('listening');
    expect(hubState({ state: 'failed', reason: 'no-home' })).toBe('failed');
  });
});
