import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_CONFIG, INTERVAL_MS } from '@/core/backup/auto';
import type { DriveInfo } from '@/core/platform/disk';
import { hubState, mainDrive, nextBackup } from '../logic';

const AT = 1_800_000_000_000;
const on = { ...DEFAULT_AUTO_CONFIG, enabled: true };

describe('next automatic backup', () => {
  it('is "by hand" where the platform has no automatic backup, whatever is stored', () => {
    expect(nextBackup(false, on, { at: AT, ok: true }, AT)).toEqual({ state: 'manual' });
  });
  it('is off while the switch is off', () => {
    expect(nextBackup(true, DEFAULT_AUTO_CONFIG, { at: AT, ok: true }, AT)).toEqual({
      state: 'off',
    });
  });
  it('is one interval after the last good run', () => {
    expect(nextBackup(true, on, { at: AT, ok: true }, AT + 1000)).toEqual({
      state: 'planned',
      at: AT + INTERVAL_MS.daily,
    });
    expect(
      nextBackup(true, { ...on, interval: 'weekly' }, { at: AT, ok: true }, AT + 1000),
    ).toEqual({ state: 'planned', at: AT + INTERVAL_MS.weekly });
  });
  it('is due without a run, after a failed run and once the interval is over (same rule as the runner)', () => {
    expect(nextBackup(true, on, undefined, AT)).toEqual({ state: 'due' });
    expect(nextBackup(true, on, { at: AT, ok: false, error: 'write-failed' }, AT + 1)).toEqual({
      state: 'due',
    });
    expect(nextBackup(true, on, { at: AT, ok: true }, AT + INTERVAL_MS.daily)).toEqual({
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

describe('the drive the page speaks about', () => {
  it('is the system drive, else the first fixed one, else none', () => {
    const system = drive({ root: 'C:\\', isSystem: true });
    expect(mainDrive([drive({}), system])).toBe(system);
    const fixed = drive({});
    expect(mainDrive([drive({ kind: 'removable' }), fixed])).toBe(fixed);
    expect(mainDrive([drive({ kind: 'network' })])).toBeUndefined();
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
});
