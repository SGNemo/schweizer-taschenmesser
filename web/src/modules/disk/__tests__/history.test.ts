import { beforeEach, describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { growthSinceScan, MAX_POINTS, useDriveHistory } from '../history';

const GB = 1024 ** 3;
const drive = (free: number): DriveInfo => ({
  root: 'C:\\',
  label: '',
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: 500 * GB,
  freeBytes: free * GB,
  bus: 'nvme',
  model: null,
  isSystem: true,
  health: { status: 'ok', temperatureC: null, gap: null },
});

describe('drive history (memory only)', () => {
  beforeEach(() => useDriveHistory.setState({ points: {}, lastScan: {} }));

  it('records used space and skips unchanged readings', () => {
    const { record } = useDriveHistory.getState();
    record([drive(100)]);
    record([drive(100)]);
    record([drive(90)]);
    const pts = useDriveHistory.getState().points['C:\\']!;
    expect(pts.map((p) => p.usedBytes / GB)).toEqual([400, 410]);
  });

  it('keeps a bounded number of points', () => {
    const { record } = useDriveHistory.getState();
    for (let i = 0; i < MAX_POINTS + 30; i++) record([drive(400 - i * 0.5)]);
    expect(useDriveHistory.getState().points['C:\\']).toHaveLength(MAX_POINTS);
  });

  it('computes growth since the last scan', () => {
    const { record, recordScan } = useDriveHistory.getState();
    record([drive(100)]);
    recordScan('C:\\', 400 * GB);
    record([drive(96.8)]);
    const s = useDriveHistory.getState();
    const last = s.points['C:\\']!.at(-1);
    expect(growthSinceScan(s.lastScan['C:\\'], last)! / GB).toBeCloseTo(3.2, 1);
    expect(growthSinceScan(undefined, last)).toBeNull();
    expect(growthSinceScan(s.lastScan['C:\\'], undefined)).toBeNull();
  });
});
