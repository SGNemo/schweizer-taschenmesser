// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import {
  createTripleTap,
  initSafeMode,
  isSafeMode,
  requestSafeModeOnce,
  setSafeModeForTests,
} from './safeMode';

afterEach(() => {
  setSafeModeForTests(false);
  localStorage.clear();
});

describe('safe mode', () => {
  it('is off by default', async () => {
    expect(await initSafeMode('')).toBe(false);
    expect(isSafeMode()).toBe(false);
  });

  it('starts with all modules off, without writing anything', async () => {
    const normal = await loadModuleStates();
    expect(Object.values(normal).some(Boolean)).toBe(true);
    setSafeModeForTests(true);
    const states = await loadModuleStates();
    expect(Object.keys(states).sort()).toEqual(
      availableManifests()
        .map((m) => m.id)
        .sort(),
    );
    expect(Object.values(states).every((v) => v === false)).toBe(true);
    setSafeModeForTests(false);
    expect(await loadModuleStates()).toEqual(normal);
  });

  it('the one-shot switch lasts for exactly one start', async () => {
    const reload = vi.fn();
    requestSafeModeOnce(reload);
    expect(reload).toHaveBeenCalledOnce();
    expect(await initSafeMode('')).toBe(true);
    expect(await initSafeMode('')).toBe(false);
  });

  it('?safe=1 asks for it too', async () => {
    expect(await initSafeMode('?safe=1')).toBe(true);
  });

  it('triple tap needs three taps close together', () => {
    const hit = vi.fn();
    let t = 0;
    const tap = createTripleTap(hit, 900, () => t);
    tap();
    t = 300;
    tap();
    t = 2000; // too late: the first two are forgotten
    tap();
    expect(hit).not.toHaveBeenCalled();
    t = 2300;
    tap();
    t = 2600;
    tap();
    expect(hit).toHaveBeenCalledOnce();
  });
});
