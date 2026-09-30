import { describe, expect, it } from 'vitest';
import { driveLevel, formatBytes, formatDuration, percent } from '../format';

describe('formatBytes', () => {
  it('uses powers of 1024 and German decimals', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1.023 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5 GB');
    expect(formatBytes(512 * 1024 ** 3)).toBe('512 GB');
    expect(formatBytes(1.5 * 1024 ** 4)).toBe('1,5 TB');
  });
  it('rejects nonsense', () => {
    expect(formatBytes(-1)).toBe('–');
    expect(formatBytes(NaN)).toBe('–');
  });
});

describe('percent and level', () => {
  it('clamps and guards a zero total', () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(5, 0)).toBe(0);
    expect(percent(300, 200)).toBe(100);
  });
  it('flags nearly full drives', () => {
    expect(driveLevel(74)).toBe('ok');
    expect(driveLevel(75)).toBe('tight');
    expect(driveLevel(90)).toBe('full');
  });
});

describe('formatDuration', () => {
  it('reads naturally', () => {
    expect(formatDuration(300)).toBe('< 1 s');
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(125_000)).toBe('2 min 5 s');
  });
});
