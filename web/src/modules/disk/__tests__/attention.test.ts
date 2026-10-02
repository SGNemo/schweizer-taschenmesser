import { describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { driveAttention } from '../logic/attention';

const GB = 1024 ** 3;
const drive = (p: Partial<DriveInfo>): DriveInfo => ({
  root: 'C:\\',
  label: 'System',
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: 500 * GB,
  freeBytes: 200 * GB,
  bus: 'nvme',
  model: null,
  isSystem: true,
  health: { status: 'ok', temperatureC: null, gap: null },
  ...p,
});

describe('driveAttention', () => {
  it('flags an almost full fixed drive as a warning, never as danger', () => {
    const items = driveAttention([drive({ freeBytes: 20 * GB })]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tone: 'warning', to: '/disk' });
    expect(items[0]!.title).toContain('C:\\ (System)');
  });
  it('leaves roomy drives, USB sticks and network drives alone', () => {
    expect(
      driveAttention([
        drive({}),
        drive({ kind: 'removable', freeBytes: 0 }),
        drive({ kind: 'network', freeBytes: 0 }),
      ]),
    ).toEqual([]);
  });
});
