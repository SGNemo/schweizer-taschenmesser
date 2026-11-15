import { describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { MAX_ADVICE, tidyHelps, trimFact, troubledDrives } from '../logic/advice';

const GB = 1024 ** 3;

const drive = (over: Partial<DriveInfo> = {}): DriveInfo => ({
  root: 'C:\\',
  label: '',
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: 500 * GB,
  freeBytes: 200 * GB,
  bus: 'nvme',
  model: null,
  isSystem: true,
  health: { status: 'ok', temperatureC: null, gap: null },
  ...over,
});
const bad = { status: 'warning', temperatureC: null, gap: null } as const;

describe('drives that report problems', () => {
  it('names built-in drives with a warning and nothing else', () => {
    const d = drive({ root: 'D:\\', isSystem: false, health: bad });
    expect(troubledDrives([drive(), d]).map((x) => x.root)).toEqual(['D:\\']);
    expect(troubledDrives([drive()])).toEqual([]);
    expect(
      troubledDrives([
        drive({ health: { status: 'unknown', temperatureC: null, gap: 'needsAdmin' } }),
      ]),
    ).toEqual([]);
  });

  it('leaves USB, removable and network drives alone', () => {
    expect(
      troubledDrives([
        drive({ bus: 'usb', health: bad }),
        drive({ kind: 'removable', health: bad }),
        drive({ kind: 'network', health: bad }),
      ]),
    ).toEqual([]);
  });

  it('never shows more than three', () => {
    const many = ['C', 'D', 'E', 'F', 'G'].map((l) => drive({ root: `${l}:\\`, health: bad }));
    expect(troubledDrives(many)).toHaveLength(MAX_ADVICE);
  });
});

describe('the next step of an almost full drive', () => {
  it('is the tidy tab only for the system drive', () => {
    expect(tidyHelps(drive(), 'full')).toBe(true);
    expect(tidyHelps(drive(), 'tight')).toBe(false);
    expect(tidyHelps(drive({ isSystem: false }), 'full')).toBe(false);
    expect(tidyHelps(drive({ bus: 'usb' }), 'full')).toBe(false);
  });
});

describe('the TRIM fact', () => {
  it('is shown for a built-in NTFS SSD when the state is known', () => {
    expect(trimFact(drive(), { trimOff: true })).toBe('off');
    expect(trimFact(drive(), { trimOff: false })).toBe('on');
  });

  it('says nothing when unknown or when it does not apply', () => {
    expect(trimFact(drive(), null)).toBeNull();
    expect(trimFact(drive(), { trimOff: null })).toBeNull();
    expect(trimFact(drive({ media: 'hdd' }), { trimOff: true })).toBeNull();
    expect(trimFact(drive({ fileSystem: 'ReFS' }), { trimOff: true })).toBeNull();
    expect(trimFact(drive({ bus: 'usb' }), { trimOff: true })).toBeNull();
    expect(trimFact(drive({ kind: 'removable' }), { trimOff: true })).toBeNull();
  });
});
