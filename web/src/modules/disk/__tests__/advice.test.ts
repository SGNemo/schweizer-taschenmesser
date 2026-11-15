import { describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { adviceFor, MAX_ADVICE } from '../logic/advice';

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

describe('recommendations for the drives tab', () => {
  it('says nothing when everything is fine or simply unknown', () => {
    expect(adviceFor([drive()], { trimOff: false })).toEqual([]);
    expect(adviceFor([drive()], null)).toEqual([]);
    expect(adviceFor([drive()], { trimOff: null })).toEqual([]);
    expect(
      adviceFor(
        [drive({ health: { status: 'unknown', temperatureC: null, gap: 'needsAdmin' } })],
        null,
      ),
    ).toEqual([]);
    expect(adviceFor([], { trimOff: true })).toEqual([]);
  });

  it('names an almost full drive with what is left, the system drive first', () => {
    const d = drive({ root: 'D:\\', isSystem: false, freeBytes: 10 * GB });
    const c = drive({ freeBytes: 30 * GB });
    expect(adviceFor([d, c], null)).toEqual([
      { kind: 'full', root: 'C:\\', freeBytes: 30 * GB },
      { kind: 'full', root: 'D:\\', freeBytes: 10 * GB },
    ]);
  });

  it('counts a big drive with under 5 GB left as full', () => {
    const big = drive({ totalBytes: 4000 * GB, freeBytes: 4 * GB });
    expect(adviceFor([big], null).map((a) => a.kind)).toEqual(['full']);
  });

  it('puts a drive that reports problems first', () => {
    const bad = drive({
      root: 'D:\\',
      isSystem: false,
      health: { status: 'warning', temperatureC: null, gap: null },
    });
    const full = drive({ freeBytes: 2 * GB });
    expect(adviceFor([full, bad], null).map((a) => [a.kind, a.root])).toEqual([
      ['health', 'D:\\'],
      ['full', 'C:\\'],
    ]);
  });

  it('mentions TRIM only when it is known to be off and an SSD is built in', () => {
    expect(adviceFor([drive()], { trimOff: true })).toEqual([{ kind: 'trimOff', root: null }]);
    expect(adviceFor([drive({ media: 'hdd' })], { trimOff: true })).toEqual([]);
    expect(adviceFor([drive({ kind: 'removable' })], { trimOff: true })).toEqual([]);
  });

  it('leaves network and removable drives alone', () => {
    const usb = drive({ kind: 'removable', freeBytes: 0 });
    const net = drive({ kind: 'network', freeBytes: 0 });
    expect(adviceFor([usb, net], null)).toEqual([]);
  });

  it('never shows more than three', () => {
    const many = ['C', 'D', 'E', 'F', 'G'].map((l) =>
      drive({ root: `${l}:\\`, isSystem: l === 'C', freeBytes: GB }),
    );
    const out = adviceFor(many, { trimOff: true });
    expect(out).toHaveLength(MAX_ADVICE);
    expect(out[0]?.root).toBe('C:\\');
  });
});
