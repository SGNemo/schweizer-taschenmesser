import { describe, expect, it, vi } from 'vitest';
import { allManifests } from './registry';
import { createServiceManager } from './services';
import type { ModuleManifest } from './types';

function fake(id: string, start: () => () => void): ModuleManifest {
  return {
    ...allManifests[0]!,
    id,
    contributions: { services: async () => ({ default: start }) },
  } as ModuleManifest;
}

describe('service manager', () => {
  it('starts services of enabled modules once and stops them when disabled', async () => {
    const stop = vi.fn();
    const start = vi.fn(() => stop);
    const m = createServiceManager([
      fake('a', start),
      fake(
        'b',
        vi.fn(() => vi.fn()),
      ),
    ]);

    await m.update({ a: true, b: false });
    await m.update({ a: true, b: false });
    expect(start).toHaveBeenCalledTimes(1);
    expect(m.running()).toEqual(['a']);

    await m.update({ a: false, b: false });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(m.running()).toEqual([]);

    await m.update({ a: true, b: false });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('serialises rapid toggles', async () => {
    const stop = vi.fn();
    const start = vi.fn(() => stop);
    const m = createServiceManager([fake('a', start)]);
    void m.update({ a: true });
    void m.update({ a: false });
    void m.update({ a: true });
    await m.update({ a: false });
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(m.running()).toEqual([]);
  });

  it('survives a service that fails to start; stopAll stops everything', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stop = vi.fn();
    const m = createServiceManager([
      fake('bad', () => {
        throw new Error('boom');
      }),
      fake('ok', () => stop),
    ]);
    await m.update({ bad: true, ok: true });
    expect(m.running()).toEqual(['ok']);
    await m.stopAll();
    expect(stop).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
