import { describe, expect, it } from 'vitest';
import { hasAiSchema } from '@/core/ai/scope';
import { apiCollections, BLOCKED_MODULES } from '@/core/dataapi/scope';
import { validateManifest, availableManifestsFor } from '@/core/modules/registry';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import { formatBytes, formatUptime, percent } from '../format';
import manifest from '../manifest';

describe('system module', () => {
  it('is desktop only, off by default, and closed to every outside reader', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.platforms).toEqual(['desktop']);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.dataSchema.collections).toEqual({});
    expect(hasAiSchema(manifest)).toBe(false);
    expect(manifest.widgets).toEqual([]);
    expect(Object.keys(manifest.contributions ?? {})).toEqual(['onboarding']);
    expect(manifest.dataApi).toBe(false);
    expect(BLOCKED_MODULES).toContain('system');
    expect(apiCollections(manifest)).toEqual([]);
    expect(availableManifestsFor('desktop')).toContain(manifest);
    expect(availableManifestsFor('android')).not.toContain(manifest);
    expect(availableManifestsFor('web')).not.toContain(manifest);
  });
});

describe('formatting', () => {
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
      'cpu',
      'gpus',
      'memory',
      'network',
      'os',
      'uptimeSecs',
    ]);
    expect(JSON.stringify(info)).not.toMatch(/mac|serial|hostname/i);
    expect((await s.processes()).map((p) => p.memoryBytes)).toEqual(
      [...(await s.processes()).map((p) => p.memoryBytes)].sort((a, b) => b - a),
    );
  });
});
