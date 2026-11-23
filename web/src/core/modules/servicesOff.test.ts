import { describe, expect, it, vi } from 'vitest';
import { allManifests } from './registry';
import { createServiceManager } from './services';
import type { ModuleManifest } from './types';

// E3 (launch review 2026-11): a module that is off when the app starts (switched off by sync
// while the app was closed) never ran its service, so the service's stop never told the native
// side. `servicesOff` runs once while the module is off, and again after it was on in between.
describe('service manager: servicesOff', () => {
  it('runs once for a module that is off, again only after it was on in between', async () => {
    const off = vi.fn();
    const m = createServiceManager([
      {
        ...allManifests[0]!,
        id: 'x',
        contributions: {
          services: async () => ({ default: () => () => undefined }),
          servicesOff: async () => ({ default: off }),
        },
      } as ModuleManifest,
    ]);
    await m.update({ x: false });
    await m.update({ x: false });
    expect(off).toHaveBeenCalledTimes(1);
    await m.update({ x: true });
    expect(off).toHaveBeenCalledTimes(1);
    await m.update({ x: false });
    expect(off).toHaveBeenCalledTimes(2);
  });
});
