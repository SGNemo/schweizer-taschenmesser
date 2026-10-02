import { describe, expect, it } from 'vitest';
import type { DriveHealth, DriveInfo } from '@/core/platform/disk';
import {
  busLabel,
  driveType,
  fillLevel,
  formatCapacity,
  formatDelta,
  healthView,
} from '../logic/drives';

const GB = 1024 ** 3;
const TB = 1024 ** 4;

describe('formatCapacity', () => {
  it('uses one decimal for GB and TB', () => {
    expect(formatCapacity(512 * GB)).toBe('512,0 GB');
    expect(formatCapacity(1.8 * TB)).toBe('1,8 TB');
    expect(formatCapacity(41.25 * GB)).toBe('41,3 GB');
  });
  it('uses whole MB and KB below a gigabyte and survives bad input', () => {
    expect(formatCapacity(300 * 1024 ** 2)).toBe('300 MB');
    expect(formatCapacity(2048)).toBe('2 KB');
    expect(formatCapacity(-1)).toBe('–');
    expect(formatCapacity(NaN)).toBe('–');
  });
});

describe('formatDelta', () => {
  it('signs the change and ignores noise', () => {
    expect(formatDelta(3.2 * GB)).toBe('+3,2 GB');
    expect(formatDelta(-1.1 * GB)).toBe('−1,1 GB');
    expect(formatDelta(10 * 1024 ** 2)).toBe('±0 GB');
  });
});

describe('driveType', () => {
  const d = (p: Partial<DriveInfo>) =>
    driveType({ kind: 'fixed', media: 'unknown', bus: 'unknown', ...p });
  it('prefers what the user would call it', () => {
    expect(d({ bus: 'nvme', media: 'ssd' })).toBe('nvme');
    expect(d({ media: 'ssd', bus: 'sata' })).toBe('ssd');
    expect(d({ media: 'hdd' })).toBe('hdd');
    expect(d({ kind: 'removable', bus: 'usb' })).toBe('usb');
    expect(d({ kind: 'removable' })).toBe('removable');
    expect(d({ kind: 'network' })).toBe('network');
    expect(d({})).toBe('drive');
  });
  it('labels interfaces', () => {
    expect(busLabel('nvme')).toBe('NVMe');
    expect(busLabel('virtual')).toBeNull();
  });
});

describe('fillLevel', () => {
  it('uses the warning thresholds', () => {
    expect(fillLevel(50, 200 * GB)).toBe('ok');
    expect(fillLevel(75, 100 * GB)).toBe('tight');
    expect(fillLevel(89, 100 * GB)).toBe('tight');
    expect(fillLevel(90, 100 * GB)).toBe('full');
    expect(fillLevel(100, 0)).toBe('full');
  });
  it('treats almost no free space as full on any size', () => {
    expect(fillLevel(60, 3 * GB)).toBe('full');
    expect(fillLevel(60, 5 * GB)).toBe('ok');
  });
});

describe('healthView', () => {
  const h = (p: Partial<DriveHealth>): DriveHealth => ({
    status: 'unknown',
    temperatureC: null,
    gap: null,
    ...p,
  });
  it('maps status and gap', () => {
    expect(healthView(h({ status: 'ok' }))).toEqual({ key: 'ok', tone: 'ok' });
    expect(healthView(h({ status: 'warning' }))).toEqual({ key: 'warning', tone: 'warning' });
    expect(healthView(h({ gap: 'needsAdmin' }))).toEqual({ key: 'needsAdmin', tone: 'muted' });
    expect(healthView(h({ gap: 'unsupported' }))).toEqual({ key: 'unsupported', tone: 'muted' });
    expect(healthView(h({}))).toEqual({ key: 'needsAdmin', tone: 'muted' });
  });
});
