/**
 * Scan results contain file and folder names: they must never reach the AI, the search, the JSON
 * import / local API, sync, backup or the dashboard, and the module exists on the desktop only.
 */
import { describe, expect, it } from 'vitest';
import { hasAiSchema } from '@/core/ai/scope';
import { apiCollections, BLOCKED_MODULES, isDataApiModule } from '@/core/dataapi/scope';
import { allManifests, availableManifestsFor } from '@/core/modules/registry';
import manifest from '../manifest';

describe('disk module is closed to every outside reader', () => {
  it('has no data, no aiSchema, only the drives widget and no contributions besides onboarding', () => {
    expect(manifest.dataSchema.collections).toEqual({});
    expect(manifest.aiSchema).toBeUndefined();
    expect(hasAiSchema(manifest)).toBe(false);
    expect(manifest.widgets.map((w) => w.id)).toEqual(['status']);
    expect(Object.keys(manifest.contributions ?? {})).toEqual(['onboarding']);
  });

  it('is blocked for the data API twice (opt-out and id block)', () => {
    expect(manifest.dataApi).toBe(false);
    expect(BLOCKED_MODULES).toContain('disk');
    expect(apiCollections(manifest)).toEqual([]);
    expect(isDataApiModule(manifest)).toBe(false);
  });

  it('exists on the desktop only and is off by default', () => {
    expect(manifest.platforms).toEqual(['desktop']);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.layout).toBe('full');
    expect(allManifests).toContain(manifest);
    expect(availableManifestsFor('desktop')).toContain(manifest);
    expect(availableManifestsFor('android')).not.toContain(manifest);
    expect(availableManifestsFor('web')).not.toContain(manifest);
  });
});
