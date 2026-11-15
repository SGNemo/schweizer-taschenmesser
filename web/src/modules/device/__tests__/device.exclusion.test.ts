/**
 * Module package S-b: the state of this device is shown, never stored. Nothing of it may reach the assistant, the
 * search, the JSON import / local API, sync or a backup; the module exists on every platform, so the area System is
 * there on the phone too, and it reaches an existing installation only through the library.
 */
import { describe, expect, it } from 'vitest';
import { hasAiSchema } from '@/core/ai/scope';
import { apiCollections, BLOCKED_MODULES, isDataApiModule } from '@/core/dataapi/scope';
import { allManifests, availableManifestsFor, validateManifest } from '@/core/modules/registry';
import { DEVICE_STATUS_PATH } from '@/core/status/summary';
import manifest from '../manifest';

describe('device module is closed to every outside reader', () => {
  it('has no data, no aiSchema, one status widget and no contributions besides onboarding', () => {
    expect(manifest.dataSchema.collections).toEqual({});
    expect(manifest.aiSchema).toBeUndefined();
    expect(hasAiSchema(manifest)).toBe(false);
    expect(manifest.widgets.map((w) => w.id)).toEqual(['status']);
    // No attention item, no search, no calendar item, no quick add: the page only shows.
    expect(Object.keys(manifest.contributions ?? {})).toEqual(['onboarding']);
    expect(manifest.seed).toEqual({ version: 1, dependsOn: [], none: 'live-data' });
  });

  it('is blocked for the data API twice (opt-out and id block)', () => {
    expect(manifest.dataApi).toBe(false);
    expect(BLOCKED_MODULES).toContain('device');
    expect(apiCollections(manifest)).toEqual([]);
    expect(isDataApiModule(manifest)).toBe(false);
  });

  it('exists on every platform in the area System, at /device, stable and off by default', () => {
    expect(manifest.platforms).toBeUndefined();
    expect(manifest.area).toBe('system');
    expect(manifest.routes.map((r) => r.path)).toEqual(['/device']);
    // The settings lead to this path while the module is on.
    expect(manifest.routes[0]?.path).toBe(DEVICE_STATUS_PATH);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.maturity).toBe('stable');
    expect(allManifests).toContain(manifest);
    for (const kind of ['desktop', 'android', 'web'] as const)
      expect(availableManifestsFor(kind), kind).toContain(manifest);
  });

  it('is a module of the area System on the phone and in the browser, so the area exists there', () => {
    for (const kind of ['android', 'web'] as const)
      expect(
        availableManifestsFor(kind)
          .filter((m) => m.area === 'system' && !m.retired)
          .map((m) => m.id),
        kind,
      ).toContain('device');
  });

  it('is a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });
});
