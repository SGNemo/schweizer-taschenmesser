import { describe, expect, it } from 'vitest';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import { formatBytes, formatUptime, percent } from '../format';
import { BLOCKED_MODULES } from '@/core/dataapi/scope';
import { allManifests } from '@/core/modules/registry';

describe('system formatting', () => {
  it('formats sizes, shares and uptime', () => {
    expect(formatBytes(16 * 1024 ** 3)).toBe('16 GB');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(-1)).toBe('–');
    expect(percent(9.5, 16)).toBe(59);
    expect(percent(1, 0)).toBe(0);
    expect(percent(5, 2)).toBe(100);
    expect(formatUptime(3 * 86_400 + 5 * 3600 + 7 * 60 + 9)).toEqual({
      days: 3,
      hours: 5,
      minutes: 7,
    });
    expect(formatUptime(-4)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});

describe('the e2e stand-in', () => {
  it('has the shape of the native reading and nothing that identifies the machine', async () => {
    const s = createFakeSystem();
    const info = await s.info();
    expect(Object.keys(info).sort()).toEqual([
      'battery',
      'bootTimeSecs',
      'cpu',
      'gpus',
      'hardware',
      'memory',
      'network',
      'os',
      'uptimeSecs',
    ]);
    expect(JSON.stringify(info)).not.toMatch(/mac|serial|hostname/i);
    expect(JSON.stringify(info.gpus)).not.toMatch(/basic render/i);
    expect(info.gpus.filter((g) => g.active)).toHaveLength(1);
    expect((await s.processes()).map((p) => p.memoryBytes)).toEqual(
      [...(await s.processes()).map((p) => p.memoryBytes)].sort((a, b) => b - a),
    );
  });
});

describe('the former system module', () => {
  it('is gone as a module and no longer listed as blocked (it holds no data and no longer exists)', () => {
    expect(allManifests.map((m) => m.id)).not.toContain('system');
    expect(BLOCKED_MODULES).not.toContain('system');
  });
});
